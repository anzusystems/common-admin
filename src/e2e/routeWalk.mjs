// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { CARD_LOADER_SELECTOR, NO_DATA_SELECTOR, NOT_FOUND_SELECTOR, ROW_SELECTOR } from './conventions.mjs'

/**
 * The route walk: one test per route of an admin, run against the real API and its data. Each test opens the
 * page, waits until it has loaded, and fails on what it shows or logs wrong.
 *
 * It knows the conventions of common-admin (the generated route declaration, the record views, the card
 * loader; see `conventions.mjs`), not an admin's code: whatever is particular to an admin comes through
 * `RouteWalkOptions`. Node code, shipped as it is like `src/vite`: an admin's e2e project loads it without
 * a build.
 *
 * @typedef {import('playwright/test').Page} Page
 * @typedef {import('playwright/test').Request} Request
 * @typedef {import('./types.mjs').PageWatcher} PageWatcher
 * @typedef {import('./types.mjs').RecordLookup} RecordLookup
 * @typedef {import('./types.mjs').RouteVisit} RouteVisit
 * @typedef {import('./types.mjs').RouteWalkOptions} RouteWalkOptions
 * @typedef {import('./types.mjs').RouteWalkPlaywright} RouteWalkPlaywright
 * @typedef {import('./types.mjs').RouteWalkProblem} RouteWalkProblem
 * @typedef {import('./types.mjs').RouteWalkTimings} RouteWalkTimings
 */

/** @type {Readonly<RouteWalkTimings>} */
export const DEFAULT_TIMINGS = Object.freeze({
  app: 30_000,
  loader: 30_000,
  quiet: 700,
  settleLimit: 20_000,
  slowRequest: 10_000,
})

// Generous on purpose: a parameter route visits its listing first, and each visit may wait out the navigation,
// the app, the settle limit, the loaders and one reload. Only a page that hangs reaches it.
const ROUTE_TIMEOUT = 240_000
// A notification stream stays open for the whole session, so it is neither waited for nor checked.
const OPEN_REQUESTS = /\/notifications\/stream\//
const PROBLEM_PAGES = ['/unauthorized', '/error', '/login']

const PARAM = /:([a-zA-Z]+)(\([^)]*\))?/g
const OPTIONAL_PARAM = /\/:[a-zA-Z]+(\([^)]*\))?\?/g

/** @param {Partial<RouteWalkTimings> | undefined} timings */
const withDefaults = (timings) => ({ ...DEFAULT_TIMINGS, ...timings })

/** @type {import('./types.mjs').ReadDeclaredRoutes} */
export function readDeclaredRoutes(declarationFile) {
  const declaration = fs.readFileSync(declarationFile, 'utf8')
  return (
    [...declaration.matchAll(/'[^']+':\s*RouteRecordInfo<\s*'[^']*',\s*'([^']+)'/g)]
      // The declaration is TypeScript source: a `\d` constraint is written there with an escaped backslash.
      .map(([, routePath]) => (routePath ?? '').replace(/\\\\/g, '\\'))
      .filter((routePath) => !routePath.includes('pathMatch'))
  )
}

/**
 * @param {string} dir
 * @returns {number}
 */
const countPageFiles = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce(
      (count, entry) =>
        count +
        (entry.isDirectory() ? countPageFiles(path.join(dir, entry.name)) : entry.name.endsWith('.vue') ? 1 : 0),
      0
    )

/**
 * Fills the parameters known by name, then drops the optional ones still unknown. What is left is opened with
 * the first record of its listing: the address up to that parameter (`/keywords/:id(\d+)/edit` -> `/keywords`).
 *
 * @param {string} routePath
 * @param {Record<string, string>} known
 */
const fillKnown = (routePath, known) => {
  /** @type {{ name: string; pattern: RegExp }[]} */
  const unresolved = []
  const filled = routePath
    .replace(OPTIONAL_PARAM, (match) => {
      const name = (match.slice(2).split('(')[0] ?? '').replace(/\?$/, '')
      return known[name] !== undefined ? `/${known[name]}` : ''
    })
    .replace(PARAM, (match, /** @type {string} */ name, /** @type {string | undefined} */ constraint) => {
      const value = known[name]
      if (value !== undefined) return value
      unresolved.push({ name, pattern: constraint ? new RegExp(`^${constraint.slice(1, -1)}$`) : /^[^/]+$/ })
      return match
    })
  return { filled, unresolved }
}

/**
 * A pathname without a trailing slash, so that `/x/` and `/x` compare equal.
 *
 * @param {string} pathname
 */
const normalizePath = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)

/** @type {import('./types.mjs').WatchPage} */
export function watchPage(page, { openRequests = OPEN_REQUESTS, timings } = {}) {
  const ownSlowRequest = withDefaults(timings).slowRequest
  let slowRequest = ownSlowRequest
  /** @type {RouteWalkProblem[]} */
  let problems = []
  /** Chromium's "Failed to load resource" lines, by the url they name: reported only when nothing else said so. */
  /** @type {{ line: RouteWalkProblem; url: string }[]} */
  let loadFailures = []
  /** Every url that answered 4xx/5xx or failed, whatever its type and whether reported or not. */
  /** @type {Set<string>} */
  const failedUrls = new Set()
  let apiAnswered = 0
  /** @type {Map<Request, number>} */
  const inFlight = new Map()
  // When a request last started or ended: one that does both between two looks at `inFlight` still counts.
  let lastActivity = 0

  /** @param {Request} request */
  const isApi = (request) => ['xhr', 'fetch'].includes(request.resourceType()) && !openRequests.test(request.url())
  /**
   * What the page itself needs to show: its document, and the scripts, styles and images of its own origin. Not
   * another origin's (an embed in a record, an image from DAM): they depend on the data and the environment. Not
   * fonts: the app loads them for all pages alike, and they have never broken.
   *
   * @param {Request} request
   */
  const isAsset = (request) => {
    const type = request.resourceType()
    if (type === 'document') return request.frame() === page.mainFrame()
    if (!['script', 'stylesheet', 'image'].includes(type)) return false
    return new URL(request.url()).origin === new URL(page.url()).origin
  }
  /** @param {Request} request */
  const ended = (request) => {
    const startedAt = inFlight.get(request)
    if (startedAt === undefined) return undefined
    inFlight.delete(request)
    lastActivity = Date.now()
    return lastActivity - startedAt
  }

  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const at = message.location().url
    const line = `console.error: ${message.text()}${at ? ` (${at})` : ''}`
    if (message.text().startsWith('Failed to load resource:')) loadFailures.push({ line, url: at })
    else problems.push(line)
  })
  page.on('request', (request) => {
    // A page's own scripts count too: until its chunk has loaded, it has neither mounted nor asked for data.
    if (isApi(request) || ['script', 'stylesheet'].includes(request.resourceType())) {
      lastActivity = Date.now()
      inFlight.set(request, lastActivity)
    }
  })
  page.on('requestfinished', (request) => {
    const tookMs = ended(request)
    // Answered, but past the clients' patience: the page waited that long.
    if (tookMs !== undefined && tookMs >= slowRequest && isApi(request)) {
      problems.push(`answered after ${Math.round(tookMs / 1000)} s: ${request.method()} ${request.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const ranFor = ended(request) ?? 0
    const failure = request.failure()?.errorText ?? ''
    if (failure === 'net::ERR_ABORTED') {
      // Cancelled by the page itself, which is no failure, unless it ran long enough to be its client's timeout:
      // that failure reaches no console, the page only shows an alert. A previous page's requests that its
      // navigation away cancelled count neither: `reset` clears what they reported.
      if (ranFor >= slowRequest) {
        problems.push(`no answer, cancelled after ${Math.round(ranFor / 1000)} s: ${request.method()} ${request.url()}`)
      }
      return
    }
    failedUrls.add(request.url())
    if (isApi(request) || isAsset(request)) {
      problems.push(`request failed: ${failure} ${request.method()} ${request.url()}`)
    }
  })
  page.on('response', (response) => {
    const request = response.request()
    if (response.status() >= 400) failedUrls.add(response.url())
    if (!isApi(request) && !isAsset(request)) return
    if (response.status() >= 400) {
      problems.push(`${request.resourceType()} ${response.status()}: ${request.method()} ${response.url()}`)
    } else if (isApi(request)) {
      apiAnswered++
    }
  })

  return {
    reset({ slowRequest: forPage } = {}) {
      slowRequest = forPage ?? ownSlowRequest
      problems = []
      loadFailures = []
      failedUrls.clear()
      apiAnswered = 0
      inFlight.clear()
      lastActivity = 0
    },
    push(problem) {
      problems.push(problem)
    },
    problems() {
      const failed = [...failedUrls]
      // Same origin and path; a url named without its query stands for any query of that path. A url that does
      // not parse accounts for nothing, so its line is reported.
      /** @param {string} failedUrl @param {string} url */
      const sameResource = (failedUrl, url) => {
        try {
          const failedAt = new URL(failedUrl)
          const at = new URL(url)
          if (failedAt.origin !== at.origin || failedAt.pathname !== at.pathname) return false
          return !at.search || failedAt.search === at.search
        } catch {
          return false
        }
      }
      /** @param {string} url */
      const accountedFor = (url) => failed.some((failedUrl) => sameResource(failedUrl, url))
      const unaccounted = loadFailures.filter(({ url }) => !url || !accountedFor(url)).map(({ line }) => line)
      // An `Api error` can also come from a 200 whose handling threw: that one is kept.
      return [...problems, ...unaccounted].filter((problem) => {
        const apiErrorUrl = /^console\.error: Api error: (\S+)/.exec(problem)?.[1]
        return !apiErrorUrl || !accountedFor(apiErrorUrl)
      })
    },
    get apiAnswered() {
      return apiAnswered
    },
    get lastActivity() {
      return lastActivity
    },
    inFlight,
  }
}

/**
 * Whether the card loaders are gone, and whether `main` says anything: the app's start-up loader is a `main`
 * without text. Undefined while the page cannot answer (a navigation interrupted the evaluation).
 *
 * @param {Page} page
 * @returns {Promise<{ loadersFinished: boolean; hasText: boolean } | undefined>}
 */
const pageState = (page) =>
  page
    .evaluate(
      (selector) => ({
        loadersFinished: Array.from(document.querySelectorAll(selector)).every(
          (loader) => getComputedStyle(loader).display === 'none' || !(/** @type {HTMLElement} */ (loader).offsetParent)
        ),
        hasText: !!document.querySelector('main')?.textContent?.trim(),
      }),
      CARD_LOADER_SELECTOR
    )
    .catch(() => undefined)

/**
 * After `settleLimit`, the requests then running are watched until they end or have run `slowRequest`: one still
 * without an answer then is a problem, however late it started. A page that keeps requesting (autorefresh) ends
 * its requests soon and is not reported.
 *
 * @param {Page} page
 * @param {PageWatcher} watcher
 * @param {RouteWalkTimings} timings
 */
const reportUnanswered = async (page, watcher, timings) => {
  const running = [...watcher.inFlight]
  const until = Math.max(0, ...running.map(([, startedAt]) => startedAt + timings.slowRequest))
  while (Date.now() < until && running.some(([request]) => watcher.inFlight.has(request))) {
    await page.waitForTimeout(100)
  }
  for (const [request, startedAt] of running) {
    if (!watcher.inFlight.has(request)) continue
    const runningFor = Date.now() - startedAt
    watcher.push(`no answer after ${Math.round(runningFor / 1000)} s: ${request.method()} ${request.url()}`)
  }
}

/**
 * The page has loaded: for a whole `quiet` interval no API request, script or style has run, no card loader has
 * shown, and `main` has said something. All three at once, since each can start the next: a page's chunk mounts
 * a loader, a loader that ends can be followed by a request. A page that keeps requesting (autorefresh) is not
 * waited for past `settleLimit`, so this returns whether it settled. The hard waits throw: a blank page, or a
 * loader still showing `loader` ms after that, is a failure.
 *
 * @param {Page} page
 * @param {PageWatcher} watcher
 * @param {RouteWalkTimings} timings
 * @returns {Promise<boolean>}
 */
const settle = async (page, watcher, timings) => {
  await page
    .locator('main')
    .first()
    .waitFor({ state: 'visible', timeout: timings.app })
    .catch((error) => {
      throw new Error('the app did not render', { cause: error })
    })
  const deadline = Date.now() + timings.settleLimit
  let busyAt = Date.now()
  let settled = false
  while (Date.now() < deadline) {
    const state = await pageState(page)
    const now = Date.now()
    if (watcher.inFlight.size > 0 || !state?.loadersFinished || !state.hasText) busyAt = now
    else if (now - Math.max(busyAt, watcher.lastActivity) >= timings.quiet) {
      settled = true
      break
    }
    await page.waitForTimeout(100)
  }
  if (!settled) await reportUnanswered(page, watcher, timings)
  const loaderDeadline = Date.now() + timings.loader
  while (!(await pageState(page))?.loadersFinished) {
    if (Date.now() >= loaderDeadline) throw new Error('a card loader never finished')
    await page.waitForTimeout(100)
  }
  return settled
}

/**
 * Elements no component stands behind: a component the template names but nothing registers or imports.
 * A production build renders it as an empty element of that name and warns nowhere.
 *
 * @param {Page} page
 * @returns {Promise<string[]>}
 */
const unresolvedComponents = (page) =>
  page.evaluate(() => [
    ...new Set(
      Array.from(document.body.querySelectorAll('*'))
        .filter(
          (element) =>
            element instanceof HTMLUnknownElement ||
            (element instanceof HTMLElement &&
              element.localName.includes('-') &&
              !customElements.get(element.localName))
        )
        .map((element) => element.localName)
    ),
  ])

/**
 * Opens the route on a fresh document. `about:blank` first, so that what the previous page still logs or
 * requests while it unloads is not blamed on this one. An app that comes up blank, without a `main` or with
 * only the start-up loader's empty one, is reloaded once: a cold boot can hit a transient failure that the next
 * one does not. A page that stays empty after that is reported as one.
 *
 * @param {Page} page
 * @param {PageWatcher} watcher
 * @param {string} target
 * @param {RouteWalkTimings} timings
 */
const openRoute = async (page, watcher, target, timings) => {
  await page.goto('about:blank')
  watcher.reset(timings)
  await page.goto(target)
  const first = await settle(page, watcher, timings).catch((/** @type {Error} */ error) => error)
  if (typeof first === 'boolean' && (await pageState(page))?.hasText) return first
  // A loader that never ends on a page that rendered is the page's failure, not the boot's.
  if (first instanceof Error && (await page.locator('main').count()) > 0) throw first
  watcher.reset(timings)
  await page.reload()
  return settle(page, watcher, timings)
}

/** @type {import('./types.mjs').VisitRoute} */
export async function visitRoute(page, watcher, target, { redirect, timings } = {}) {
  const settled = await openRoute(page, watcher, target, withDefaults(timings))
  const landedOn = normalizePath(new URL(page.url()).pathname)
  const expected = normalizePath(new URL(target, page.url()).pathname)
  if (landedOn !== expected && !redirect?.test(landedOn)) watcher.push(`redirected to ${landedOn}`)
  if ((await page.locator(NOT_FOUND_SELECTOR).count()) > 0) watcher.push('the 404 view')
  if (!(await page.locator('main').first().innerText()).trim()) watcher.push('an empty page')
  for (const tag of await unresolvedComponents(page)) watcher.push(`an unresolved component <${tag}>`)
  return { settled, landedOn, problems: watcher.problems(), apiAnswered: watcher.apiAnswered }
}

/**
 * Where a listing's first record is kept for the rest of the run: a file in the run's output folder, which the
 * boot check empties (Playwright does too when a run starts, but not in `--ui` mode). Shared by the workers, so
 * all of them open the same record, and kept when a failed test restarts its worker.
 *
 * @param {string} outputDir
 */
const recordDir = (outputDir) => path.join(outputDir, 'route-walk-records')
/** @param {string} outputDir @param {string} listing @param {RegExp} pattern */
const recordFile = (outputDir, listing, pattern) =>
  path.join(recordDir(outputDir), `${Buffer.from(`${listing} ${pattern.source}`).toString('base64url')}.json`)

/** @type {import('./types.mjs').FirstRecordOf} */
export async function firstRecordOf(
  page,
  watcher,
  listing,
  pattern,
  { outputDir, rowSelector = ROW_SELECTOR, timings }
) {
  const file = recordFile(outputDir, listing, pattern)
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))

  // `keep`: an answer the listing gives every time. One that a failed load or a page still loading gave is not kept,
  // so the routes after it look again instead of all failing on what went wrong once.
  /** @type {{ lookup: RecordLookup; keep: boolean }} */
  const { lookup, keep } = await (async () => {
    const opened = await openRoute(page, watcher, listing, withDefaults(timings)).then(
      () => undefined,
      (/** @type {Error} */ error) => error
    )
    if (opened) return { lookup: { missing: `${listing} did not load: ${opened.message}` }, keep: false }
    if ((await page.locator(NOT_FOUND_SELECTOR).count()) > 0) {
      return { lookup: { missing: `${listing} is not a page` }, keep: true }
    }
    if (!(await pageState(page))?.hasText) return { lookup: { missing: `${listing} came up empty` }, keep: false }

    const fromLink = await page.evaluate(
      ({ prefix, source }) => {
        const matches = new RegExp(source)
        return Array.from(document.querySelectorAll(`main a[href^="${prefix}/"]`))
          .map((link) => (link.getAttribute('href') ?? '').slice(prefix.length + 1).split(/[/?#]/)[0] ?? '')
          .find((candidate) => matches.test(candidate))
      },
      { prefix: listing, source: pattern.source }
    )
    if (fromLink !== undefined) return { lookup: { id: fromLink }, keep: true }

    const firstRow = page.locator(rowSelector).first()
    if ((await firstRow.count()) === 0) {
      // Empty only when the table says so: a row selector that matches nothing must not pass for no data.
      if (await page.locator(NO_DATA_SELECTOR).first().isVisible()) {
        return { lookup: { missing: `${listing} shows no record`, empty: /** @type {const} */ (true) }, keep: true }
      }
      return { lookup: { missing: `nothing in ${listing} matches the row selector` }, keep: false }
    }
    // The corner of the first cell, inside its padding: a cell can hold a link to another record
    // (a site group, a super author), and a click on it would open that one instead.
    await firstRow
      .locator('td')
      .first()
      .click({ position: { x: 3, y: 3 } })
    await page.waitForURL((url) => url.pathname.startsWith(`${listing}/`), { timeout: 10_000 }).catch(() => {})
    const candidate = new URL(page.url()).pathname.slice(listing.length + 1).split('/')[0] ?? ''
    if (!pattern.test(candidate)) {
      return { lookup: { missing: `clicking the first row of ${listing} opened ${page.url()}` }, keep: false }
    }

    return { lookup: { id: candidate }, keep: true }
  })()
  if (keep) {
    // Written aside and renamed: another worker reading meanwhile sees the whole file or none.
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const written = `${file}.${process.pid}.tmp`
    fs.writeFileSync(written, JSON.stringify(lookup))
    fs.renameSync(written, file)
  }

  return lookup
}

/** @type {import('./types.mjs').DefineRouteWalk} */
export function defineRouteWalkBoot({ test, expect }, options) {
  const timings = withDefaults(options.timings)
  test(`${options.title} - the app boots`, async ({ browser }, testInfo) => {
    fs.rmSync(recordDir(testInfo.project.outputDir), { recursive: true, force: true })
    const { baseURL, viewport, ignoreHTTPSErrors } = testInfo.project.use
    const context = await browser.newContext({ baseURL, viewport, ignoreHTTPSErrors })
    const page = await context.newPage()
    /** @type {string[]} */
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await options.login(page)
    await page.goto('/')
    // The start-up loader is a `main` too, without text: wait for a page that says something.
    await expect
      .poll(
        async () =>
          (
            await page
              .locator('main')
              .first()
              .innerText()
              .catch(() => '')
          ).trim().length,
        { message: 'the app did not render a page', timeout: timings.app }
      )
      .toBeGreaterThan(0)
    const landedOn = normalizePath(new URL(page.url()).pathname)
    expect(options.problemPages ?? PROBLEM_PAGES, `the app started on ${landedOn}`).not.toContain(landedOn)
    expect(errors, 'uncaught errors while booting').toEqual([])
    await context.close()
  })
}

/** @type {import('./types.mjs').DefineRouteWalk} */
export function defineRouteWalk({ test: base, expect }, options) {
  const routes = readDeclaredRoutes(options.declarationFile)
  const skip = options.skip ?? {}
  const noRecord = options.noRecord ?? {}
  const resolve = options.resolve ?? {}
  const ignore = options.ignore ?? []
  const timings = withDefaults(options.timings)

  // One logged-in page per worker: logging in for each of hundreds of routes would double the run.
  const test = base.extend(
    /**
     * @type {import('playwright/test').Fixtures<
     *   {},
     *   { walker: { page: Page; watcher: PageWatcher } },
     *   import('playwright/test').PlaywrightTestArgs & import('playwright/test').PlaywrightTestOptions,
     *   import('playwright/test').PlaywrightWorkerArgs & import('playwright/test').PlaywrightWorkerOptions
     * >}
     */ ({
      walker: [
        async ({ browser }, use, workerInfo) => {
          const { baseURL, viewport, ignoreHTTPSErrors, navigationTimeout } = workerInfo.project.use
          const context = await browser.newContext({ baseURL, viewport, ignoreHTTPSErrors })
          if (navigationTimeout) context.setDefaultNavigationTimeout(navigationTimeout)
          const page = await context.newPage()
          const watcher = watchPage(page, { openRequests: options.openRequests, timings })
          await options.login(page)
          await use({ page, watcher })
          await context.close()
        },
        { scope: 'worker' },
      ],
    })
  )

  test.describe(options.title, () => {
    test.describe.configure({ mode: 'parallel' })

    test.afterEach(async ({ walker }, testInfo) => {
      if (testInfo.status === testInfo.expectedStatus) return
      await testInfo.attach('screenshot', { body: await walker.page.screenshot(), contentType: 'image/png' })
    })

    test('reads every route', () => {
      // A declaration the regex no longer matches would otherwise walk nothing and pass.
      expect(routes.length, `routes in ${options.declarationFile}`).toBe(countPageFiles(options.pagesDir) - 1)
      const configured = [skip, noRecord, resolve, options.redirects ?? {}, options.routeTimings ?? {}].flatMap(
        (byRoute) => Object.keys(byRoute)
      )
      const unknown = configured.filter((routePath) => !routes.includes(routePath))
      expect(unknown, 'configured routes the app no longer has').toEqual([])
    })

    for (const routePath of routes) {
      test(`opens ${routePath}`, async ({ walker: { page, watcher } }, testInfo) => {
        test.setTimeout(ROUTE_TIMEOUT)
        test.skip(routePath in skip, skip[routePath])
        const own = options.routeTimings?.[routePath]
        const routeTimings = own ? { ...timings, ...own.timings } : timings
        if (own)
          testInfo.annotations.push({ type: 'timings', description: `${JSON.stringify(own.timings)}: ${own.reason}` })
        for (const rule of options.skipIf ?? []) {
          if (rule.routes.test(routePath)) test.skip(await rule.when(page), rule.reason)
        }

        let target
        const resolver = resolve[routePath]
        if (resolver) {
          const resolved = await resolver(page)
          test.skip(resolved === undefined, 'no record to open')
          target = /** @type {string} */ (resolved)
        } else {
          const { filled, unresolved } = fillKnown(routePath, options.params ?? {})
          expect(unresolved.length, 'parameters only `params` or `resolve` can give').toBeLessThanOrEqual(1)
          target = filled
          const [parameter] = unresolved
          if (parameter) {
            const listing = filled.slice(0, filled.indexOf(`/:${parameter.name}`))
            const record = await firstRecordOf(page, watcher, listing, parameter.pattern, {
              outputDir: testInfo.project.outputDir,
              rowSelector: options.rowSelector,
              timings,
            })
            if ('missing' in record) {
              test.skip(record.empty === true, record.missing)
              test.skip(routePath in noRecord, noRecord[routePath])
              throw new Error(
                `no record to open: ${record.missing}. List the route in \`noRecord\` if that is expected.`
              )
            }
            expect(routePath in noRecord, 'listed in `noRecord`, but a record was found').toBe(false)
            target = filled.replace(PARAM, record.id)
          }
        }

        const visit = await visitRoute(page, watcher, target, {
          redirect: options.redirects?.[routePath],
          timings: routeTimings,
        })
        if (!visit.settled) {
          testInfo.annotations.push({ type: 'kept requesting', description: `after ${routeTimings.settleLimit} ms` })
        }
        if (visit.apiAnswered === 0) {
          testInfo.annotations.push({ type: 'no data', description: 'the page made no successful API request' })
        }

        const problems = visit.problems.filter((problem) => {
          const accepted = ignore.find(
            (rule) => rule.problem.test(problem) && (!rule.routes || rule.routes.test(routePath))
          )
          if (accepted) testInfo.annotations.push({ type: 'ignored', description: `${problem} — ${accepted.reason}` })
          return !accepted
        })
        expect(problems, target).toEqual([])
      })
    }
  })
}
