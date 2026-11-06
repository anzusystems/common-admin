import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type Browser, chromium, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  defineRouteWalk,
  defineRouteWalkBoot,
  type RouteWalkOptions,
  type RouteWalkPlaywright,
} from '@/e2e/routeWalk.mjs'
import { app, ORIGIN, type PageServer, pageServer } from './support/routeWalkPages'

// What the walk registers with Playwright Test and how each test ends: the options that skip, resolve, accept a
// forward or ignore a problem, the guard over the route declaration, and the boot check. Playwright Test is
// stood in for by what the walk calls of it; the pages are real, in Chromium.

const timings = { app: 2_000, loader: 1_500, quiet: 300, settleLimit: 2_500, slowRequest: 800 }

class Skipped extends Error {}

type Body = (...args: never[]) => unknown
type WorkerFixture = (args: { browser: Browser }, use: (value: unknown) => Promise<void>, info: object) => Promise<void>

/** Collects the tests the walk registers; `run` then runs them one after another, as one worker would. */
function fakePlaywright() {
  const tests: { title: string; body: Body }[] = []
  let worker: WorkerFixture | undefined
  const test = Object.assign((title: string, body: Body) => void tests.push({ title, body }), {
    extend: (fixtures: Record<string, [WorkerFixture, object]>) => {
      worker = Object.values(fixtures)[0]?.[0]
      return test
    },
    describe: Object.assign((_title: string, body: () => void) => body(), { configure: () => {} }),
    afterEach: () => {},
    skip: (condition: boolean, reason?: string) => {
      if (condition) throw new Skipped(reason)
    },
    setTimeout: () => {},
  })
  const playwright = { test, expect } as unknown as RouteWalkPlaywright

  /** How each test ended: `passed`, `skipped: <reason>` or `failed: <message>`; and the annotations it left. */
  const run = async (outputDir: string) => {
    const outcomes: Record<string, string> = {}
    const annotations: Record<string, string[]> = {}
    const project = { outputDir, use: { baseURL: ORIGIN } }
    const runOne = async (title: string, call: (info: object) => unknown) => {
      const info = { project, annotations: [] as { type: string; description: string }[] }
      try {
        await call(info)
        outcomes[title] = 'passed'
      } catch (error) {
        // An assertion's message shortens what it got; `actual` holds all of it.
        const { message, actual } = error as Error & { actual?: unknown }
        outcomes[title] =
          error instanceof Skipped
            ? `skipped: ${message}`
            : `failed: ${message}${actual === undefined ? '' : ` ${JSON.stringify(actual)}`}`
      }
      if (info.annotations.length) annotations[title] = info.annotations.map((a) => `${a.type}: ${a.description}`)
    }
    const call = (body: Body, ...args: unknown[]) => (body as (...a: unknown[]) => unknown)(...args)
    if (worker) {
      await worker(
        { browser },
        async (walker) => {
          for (const { title, body } of tests) await runOne(title, (info) => call(body, { walker }, info))
        },
        { project }
      )
    } else {
      for (const { title, body } of tests) await runOne(title, (info) => call(body, { browser }, info))
    }
    return { outcomes, annotations }
  }
  return { playwright, run }
}

let browser: Browser
let server: PageServer
let pages: PageServer['pages']
let dir: string

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})
beforeEach(() => {
  server = pageServer()
  pages = server.pages
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-walk-'))
})
afterEach(async () => {
  await server.release()
  fs.rmSync(dir, { recursive: true, force: true })
})

/** An admin with these routes: their declaration as vue-router writes it, and one page file each. */
const admin = (routes: string[], options: Partial<RouteWalkOptions> = {}): RouteWalkOptions => {
  const declarationFile = path.join(dir, 'typed-router.d.ts')
  const pagesDir = path.join(dir, 'pages')
  fs.writeFileSync(
    declarationFile,
    [...routes, '/:pathMatch(.*)']
      .map((route, i) => `  'r${i}': RouteRecordInfo<'r${i}', '${route.replaceAll('\\', '\\\\')}', {}>,`)
      .join('\n')
  )
  fs.mkdirSync(pagesDir, { recursive: true })
  for (let i = 0; i <= routes.length; i++) fs.writeFileSync(path.join(pagesDir, `p${i}.vue`), '')
  return {
    title: 'Admin',
    declarationFile,
    pagesDir,
    login: async (page: Page) => {
      await page.context().route('**/*', server.serve)
    },
    timings,
    ...options,
  }
}

describe('defineRouteWalk', { timeout: 60_000 }, () => {
  it('opens each route as its options say, and fails what it should', async () => {
    const table = (row: string) => `<div class="v-data-table"><table><tbody>${row}</tbody></table></div>`
    const notFound = app('Not found <button data-cy="not-found-back">Back</button>')
    Object.assign(pages, {
      '/ok': app('Records', `fetch('/api/ok')`),
      '/broken': app('Records', `console.error('boom')`),
      '/known': app('Records', `fetch('/api/ok'); console.error('known noise')`),
      '/elsewhere': app('Records', `console.error('known noise')`),
      '/things': app('<a href="/things/42">42</a>'),
      '/things/42': app('Thing 42'),
      '/things/42/edit': app('Edit 42'),
      '/resolved/5': app('Resolved 5'),
      '/forwards': app('Records', `history.replaceState(null, '', '/ok')`),
      '/strays': app('Records', `history.replaceState(null, '', '/ok')`),
      '/gone': notFound,
      '/lost': notFound,
      '/listed': app('<a href="/listed/3">3</a>'),
      '/listed/3': app('Listed 3'),
      '/empty-list': app(table('<tr class="v-data-table-rows-no-data"><td>No data</td></tr>')),
      '/settings/cms': app('Settings'),
      '/slow': app('Records', `fetch('/api/slow')`),
      '/slow-allowed': app('Records', `fetch('/api/slow')`),
    })
    const routes = [
      '/ok',
      '/broken',
      '/known',
      '/elsewhere',
      '/skipped',
      '/off',
      '/things/:id(\\d+)',
      '/things/:id(\\d+)/edit',
      '/resolved/:id',
      '/unresolvable/:id',
      '/forwards',
      '/strays',
      '/gone/:id(\\d+)',
      '/lost/:id(\\d+)',
      '/listed/:id(\\d+)',
      '/empty-list/:id(\\d+)',
      '/settings/:system',
      '/slow',
      '/slow-allowed',
    ]
    const { playwright, run } = fakePlaywright()
    defineRouteWalk(
      playwright,
      admin(routes, {
        skip: { '/skipped': 'by design' },
        skipIf: [{ routes: /^\/off$/, reason: 'disabled here', when: async () => true }],
        params: { system: 'cms' },
        resolve: { '/resolved/:id': async () => '/resolved/5', '/unresolvable/:id': async () => undefined },
        noRecord: { '/gone/:id(\\d+)': 'opened from elsewhere', '/listed/:id(\\d+)': 'expected none' },
        redirects: { '/forwards': /^\/ok$/ },
        ignore: [{ problem: /known noise/, routes: /^\/known$/, reason: 'a known issue' }],
        routeTimings: { '/slow-allowed': { timings: { slowRequest: 2_000 }, reason: 'known to be slow' } },
      })
    )
    const { outcomes, annotations } = await run(dir)

    expect(outcomes).toEqual({
      'reads every route': 'passed',
      'opens /ok': 'passed',
      'opens /broken': expect.stringMatching(/^failed: .*console\.error: boom/s),
      'opens /known': 'passed',
      'opens /elsewhere': expect.stringMatching(/^failed: .*known noise/s),
      'opens /skipped': 'skipped: by design',
      'opens /off': 'skipped: disabled here',
      'opens /things/:id(\\d+)': 'passed',
      'opens /things/:id(\\d+)/edit': 'passed',
      'opens /resolved/:id': 'passed',
      'opens /unresolvable/:id': 'skipped: no record to open',
      'opens /forwards': 'passed',
      'opens /strays': expect.stringMatching(/^failed: .*redirected to \/ok/s),
      'opens /gone/:id(\\d+)': 'skipped: opened from elsewhere',
      'opens /lost/:id(\\d+)': expect.stringMatching(/^failed: no record to open: \/lost is not a page/),
      'opens /listed/:id(\\d+)': expect.stringMatching(/^failed: listed in `noRecord`, but a record was found/),
      'opens /empty-list/:id(\\d+)': 'skipped: /empty-list shows no record',
      'opens /settings/:system': 'passed',
      'opens /slow': expect.stringMatching(/^failed: .*answered after 1 s: GET http:\/\/walk\.test\/api\/slow/s),
      'opens /slow-allowed': 'passed',
    })
    expect(annotations['opens /slow-allowed']).toEqual(['timings: {"slowRequest":2000}: known to be slow'])
    expect(annotations['opens /known']).toEqual([
      `ignored: console.error: known noise (${ORIGIN}/known) — a known issue`,
    ])
  })

  it('ignores the problems of `localIgnore` only on the local stack', async () => {
    pages['/noisy'] = app('Records', `console.error('no mailer here')`)
    const options = admin(['/noisy'], {
      localIgnore: [{ problem: /no mailer here/, reason: 'the local stack runs no mailer' }],
    })
    const walk = async (env: string | undefined) => {
      const saved = process.env.E2E_ENV
      if (env === undefined) Reflect.deleteProperty(process.env, 'E2E_ENV')
      else process.env.E2E_ENV = env as typeof process.env.E2E_ENV
      try {
        const { playwright, run } = fakePlaywright()
        defineRouteWalk(playwright, options)
        return (await run(dir)).outcomes['opens /noisy']
      } finally {
        if (saved === undefined) Reflect.deleteProperty(process.env, 'E2E_ENV')
        else process.env.E2E_ENV = saved
      }
    }

    expect(await walk('local')).toBe('passed')
    expect(await walk('staging')).toMatch(/^failed: .*no mailer here/s)
    expect(await walk(undefined)).toMatch(/^failed: .*no mailer here/s)
  })

  it('fails its guard when a page file has no route, or an option names a route the app does not have', async () => {
    const options = admin(['/ok'], { skip: { '/gone': 'removed' } })
    fs.writeFileSync(path.join(options.pagesDir, 'extra.vue'), '')
    const { playwright, run } = fakePlaywright()
    defineRouteWalk(playwright, options)
    expect((await run(dir)).outcomes['reads every route']).toMatch(/^failed: routes in /)

    fs.rmSync(path.join(options.pagesDir, 'extra.vue'))
    const again = fakePlaywright()
    defineRouteWalk(again.playwright, options)
    expect((await again.run(dir)).outcomes['reads every route']).toMatch(
      /^failed: configured routes the app no longer has/
    )
  })
})

describe('defineRouteWalkBoot', { timeout: 30_000 }, () => {
  const boot = async (start: string) => {
    pages['/'] = start
    const { playwright, run } = fakePlaywright()
    defineRouteWalkBoot(playwright, admin([]))
    return (await run(dir)).outcomes['Admin - the app boots']
  }

  it('passes an app that starts on a page of its own', async () => {
    expect(
      await boot(app('', `setTimeout(() => { document.querySelector('main').textContent = 'Dashboard' }, 300)`))
    ).toBe('passed')
  })

  it('fails an app that starts on a page for visitors it cannot serve, or throws while starting', async () => {
    expect(await boot(app('Unauthorized', `history.replaceState(null, '', '/unauthorized')`))).toMatch(
      /^failed: the app started on \/unauthorized/
    )
    expect(await boot(app('Dashboard', `throw new Error('no config')`))).toMatch(
      /^failed: uncaught errors while booting/
    )
  })
})
