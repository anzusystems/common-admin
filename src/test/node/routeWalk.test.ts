import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { firstRecordOf, type PageWatcher, readDeclaredRoutes, visitRoute, watchPage } from '@/e2e/routeWalk.mjs'
import { app, BLANK, ORIGIN, type PageServer, pageServer } from './support/routeWalkPages'

// The route walk (src/e2e/routeWalk.mjs) against pages that do one thing wrong each: what it reports, and what
// it must not. Its registration of the tests is in routeWalkRegistration.test.ts.

// The pages answer at once; the defaults are made for a real API.
const timings = { app: 2_000, loader: 1_500, quiet: 300, settleLimit: 2_500, slowRequest: 800 }
// A page that never settles waits out the settle limit, then the loaders.
const SLOW_TEST = { timeout: 20_000 }

let browser: Browser
let context: BrowserContext
let page: Page
let watcher: PageWatcher
let server: PageServer
let pages: PageServer['pages']
let outputDir: string

const visit = (target: string, redirect?: RegExp) => visitRoute(page, watcher, target, { redirect, timings })
const card = `<div style="position:relative">Card<div class="a-card-loader" style="position:absolute;inset:0"></div></div>`

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})
beforeEach(async () => {
  server = pageServer()
  pages = server.pages
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-walk-'))
  context = await browser.newContext({ baseURL: ORIGIN })
  await context.route('**/*', server.serve)
  page = await context.newPage()
  watcher = watchPage(page, { timings })
})
afterEach(async () => {
  await server.release()
  await context.close()
  fs.rmSync(outputDir, { recursive: true, force: true })
})

describe('visitRoute', SLOW_TEST, () => {
  it('passes a page that loads its data', async () => {
    pages['/ok'] = app('Records', `fetch('/api/ok')`)
    expect(await visit('/ok')).toEqual({ settled: true, landedOn: '/ok', problems: [], apiAnswered: 1 })
  })

  it('reports a console.error', async () => {
    pages['/x'] = app('Records', `console.error('boom')`)
    expect((await visit('/x')).problems).toEqual([`console.error: boom (${ORIGIN}/x)`])
  })

  it('reports an uncaught error and an unhandled rejection', async () => {
    pages['/x'] = app(
      'Records',
      `setTimeout(() => { throw new Error('thrown') }); Promise.reject(new Error('rejected'))`
    )
    expect((await visit('/x')).problems.sort()).toEqual(['pageerror: rejected', 'pageerror: thrown'])
  })

  it('reports an API answer of 4xx or 5xx once, without the console lines that repeat it', async () => {
    pages['/x'] = app(
      'Records',
      `fetch('/api/missing').then(() => console.error('Api error: ${ORIGIN}/api/missing 404'));
       const request = new XMLHttpRequest(); request.open('GET', '/api/broken'); request.send()`
    )
    expect((await visit('/x')).problems.sort()).toEqual([
      `fetch 404: GET ${ORIGIN}/api/missing`,
      `xhr 500: GET ${ORIGIN}/api/broken`,
    ])
  })

  it('keeps an Api error of a request that succeeded: its handling threw', async () => {
    pages['/x'] = app('Records', `fetch('/api/ok').then(() => console.error('Api error: ${ORIGIN}/api/ok TypeError'))`)
    expect((await visit('/x')).problems).toEqual([`console.error: Api error: ${ORIGIN}/api/ok TypeError (${ORIGIN}/x)`])
  })

  it('reports a request without an answer', async () => {
    pages['/x'] = app('Records', `fetch('/api/refused').catch(() => {})`)
    expect((await visit('/x')).problems).toEqual([
      `request failed: net::ERR_CONNECTION_REFUSED GET ${ORIGIN}/api/refused`,
    ])
  })

  it("reports the page's own scripts, styles and images that fail, not another origin's", async () => {
    pages['/x'] = app(
      'Records<img src="/img/missing.png"><img src="http://other.test/img.png">',
      `document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/assets/missing.css">');
       for (const src of ['/assets/missing.js', 'http://other.test/embed.js']) {
         document.head.appendChild(Object.assign(document.createElement('script'), { src }))
       }`
    )
    expect((await visit('/x')).problems.sort()).toEqual([
      `image 404: GET ${ORIGIN}/img/missing.png`,
      `script 404: GET ${ORIGIN}/assets/missing.js`,
      `stylesheet 404: GET ${ORIGIN}/assets/missing.css`,
    ])
  })

  it('reports its document that fails, not a frame of another origin nor a font', async () => {
    pages['/x'] = app(
      '<style>@font-face { font-family: Probe; src: url(/fonts/missing.woff2) } main { font-family: Probe }</style>' +
        'Records<iframe src="http://other.test/embed"></iframe>'
    )
    expect((await visit('/server-error')).problems).toEqual([`document 500: GET ${ORIGIN}/server-error`])
    expect((await visit('/x')).problems).toEqual([])
  })

  it('reports landing elsewhere, unless the route forwards there by design', async () => {
    pages['/x'] = app('Records', `setTimeout(() => history.replaceState(null, '', '/dashboard'), 100)`)
    expect(await visit('/x')).toMatchObject({ landedOn: '/dashboard', problems: ['redirected to /dashboard'] })
    expect((await visit('/x', /^\/dashboard$/)).problems).toEqual([])
  })

  it('reports the 404 view and an empty page', async () => {
    pages['/missing'] = app('Not found <button data-cy="not-found-back">Back</button>')
    pages['/empty'] = app('')
    expect((await visit('/missing')).problems).toEqual(['the 404 view'])
    expect(await visit('/empty')).toMatchObject({ settled: false, problems: ['an empty page'] })
  })

  it('waits for an app that renders its page after the start-up loader', async () => {
    pages['/x'] = app(
      '',
      `setTimeout(() => { document.querySelector('main').textContent = 'Records'; fetch('/api/broken') }, 1_000)`
    )
    expect((await visit('/x')).problems).toEqual([`fetch 500: GET ${ORIGIN}/api/broken`])
  })

  it('reports a component nothing registers, in either case, and not a custom element', async () => {
    pages['/x'] = app(
      'Records',
      `customElements.define('x-defined', class extends HTMLElement {});
       document.querySelector('main').append(...['LocationProbeMissing', 'x-probe-missing', 'x-defined']
         .map((tag) => document.createElement(tag)))`
    )
    expect((await visit('/x')).problems).toEqual([
      'an unresolved component <locationprobemissing>',
      'an unresolved component <x-probe-missing>',
    ])
  })

  it('fails on a card loader that never ends, and waits for one that does', async () => {
    pages['/stuck'] = app(card)
    pages['/slow'] = app(
      card,
      `setTimeout(() => { document.querySelector('.a-card-loader').style.display = 'none' }, 500)`
    )
    await expect(visit('/stuck')).rejects.toThrow('a card loader never finished')
    expect((await visit('/slow')).problems).toEqual([])
  })

  // As the router loads a lazy page: after the document's load event, which `goto` waits for.
  it('fails on a card loader of a page whose chunk arrives after the app has rendered', async () => {
    pages['/x'] = app('Shell', `addEventListener('load', () => import('/assets/late-loader.js'))`)
    await expect(visit('/x')).rejects.toThrow('a card loader never finished')
  })

  it('sees a request that follows the end of a card loader', async () => {
    pages['/x'] = app(
      card,
      `setTimeout(() => {
         document.querySelector('.a-card-loader').style.display = 'none'
         setTimeout(() => fetch('/api/broken'), 100)
       }, 500)`
    )
    expect((await visit('/x')).problems).toEqual([`fetch 500: GET ${ORIGIN}/api/broken`])
  })

  it('sees requests that each start and end between two of its looks', async () => {
    pages['/x'] = app(
      'Records',
      `let left = 8
       const next = () => fetch(--left ? '/api/ok' : '/api/broken').then(() => left && setTimeout(next, 120))
       next()`
    )
    expect((await visit('/x')).problems).toEqual([`fetch 500: GET ${ORIGIN}/api/broken`])
  })

  it('reports a request unanswered after the slow limit, however late it started, but not a stream', async () => {
    pages['/hang'] = app('Records', `fetch('/api/hang')`)
    pages['/late'] = app(
      'Records',
      `const poll = setInterval(() => fetch('/api/ok'), 150)
       setTimeout(() => { clearInterval(poll); fetch('/api/hang') }, 2_000)`
    )
    pages['/stream'] = app('Records', `fetch('/notifications/stream/1')`)
    const unanswered = [expect.stringMatching(/^no answer after \d+ s: GET http:\/\/walk\.test\/api\/hang$/)]
    expect(await visit('/hang')).toMatchObject({ settled: false, problems: unanswered })
    expect(await visit('/late')).toMatchObject({ settled: false, problems: unanswered })
    expect(await visit('/stream')).toMatchObject({ settled: true, problems: [] })
  })

  it('does not report the request of a page that keeps polling, running when it stops waiting', async () => {
    pages['/x'] = app('Records', `const poll = () => fetch('/api/poll').then(poll); poll()`)
    expect(await visit('/x')).toMatchObject({ settled: false, problems: [] })
  })

  it('reports an answer that took past the slow limit, and one the page gave up on, not one it cancelled at once', async () => {
    const cancelAfter = (ms: number) =>
      app(
        'Records',
        `const controller = new AbortController();
         fetch('/api/hang', { signal: controller.signal }).catch(() => {});
         setTimeout(() => controller.abort(), ${ms})`
      )
    pages['/slow'] = app('Records', `fetch('/api/slow')`)
    pages['/late'] = cancelAfter(1_000)
    pages['/soon'] = cancelAfter(50)
    expect((await visit('/slow')).problems).toEqual([`answered after 1 s: GET ${ORIGIN}/api/slow`])
    expect((await visit('/late')).problems).toEqual([`no answer, cancelled after 1 s: GET ${ORIGIN}/api/hang`])
    expect((await visit('/soon')).problems).toEqual([])
  })

  it('reloads an app that comes up blank once, and fails one that stays blank', async () => {
    let loads = 0
    pages['/flaky'] = () => (++loads === 1 ? BLANK : app('Records'))
    pages['/blank'] = BLANK
    expect((await visit('/flaky')).problems).toEqual([])
    await expect(visit('/blank')).rejects.toThrow('the app did not render')
  })
})

describe('firstRecordOf', () => {
  const pattern = /^\d+$/
  const lookup = () => firstRecordOf(page, watcher, '/things', pattern, { outputDir, timings })
  const table = (row: string) => `<div class="v-data-table"><table><tbody>${row}</tbody></table></div>`

  it('takes the first link to a record, then keeps it for the run', async () => {
    pages['/things'] = app('<a href="/things/new">New</a><a href="/things/42/edit">42</a><a href="/things/7">7</a>')
    expect(await lookup()).toEqual({ id: '42' })
    pages['/things'] = app('<a href="/things/9">9</a>')
    expect(await lookup()).toEqual({ id: '42' })
  })

  it('clicks the first row when no link leads to a record', async () => {
    pages['/things'] = app(
      table(`<tr onclick="history.pushState(null, '', '/things/7')"><td>Seven</td></tr><tr><td>Eight</td></tr>`)
    )
    expect(await lookup()).toEqual({ id: '7' })
  })

  it('tells an empty listing from rows the selector does not match', async () => {
    pages['/things'] = app(table('<tr class="v-data-table-rows-no-data"><td>No data</td></tr>'))
    expect(await lookup()).toEqual({ missing: '/things shows no record', empty: true })
    fs.rmSync(path.join(outputDir, 'route-walk-records'), { recursive: true, force: true })
    pages['/things'] = app('<ul><li>Seven</li></ul>')
    expect(await lookup()).toEqual({ missing: 'nothing in /things matches the row selector' })
  })
})

describe('readDeclaredRoutes', () => {
  it('reads the declared paths, unescaped, without the catch-all', () => {
    const file = path.join(outputDir, 'typed-router.d.ts')
    fs.writeFileSync(
      file,
      `export interface RouteNamedMap {
    '/(cms)/keywords/[id]/edit': RouteRecordInfo<'/(cms)/keywords/[id]/edit', '/keywords/:id(\\\\d+)/edit', { id: ParamValue<true> }>,
    '/[...pathMatch]': RouteRecordInfo<'/[...pathMatch]', '/:pathMatch(.*)', { pathMatch: ParamValue<true> }>,
  }`
    )
    expect(readDeclaredRoutes(file)).toEqual(['/keywords/:id(\\d+)/edit'])
  })
})
