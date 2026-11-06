import type {
  Expect,
  Page,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  Request,
  TestType,
} from 'playwright/test'

/** Something a page did wrong, matched by `RouteWalkIgnore.problem` as text. */
export type RouteWalkProblem = string

export interface RouteWalkIgnore {
  /** Matched against the problem's text, e.g. `/^console\.error: .*ResizeObserver/`. */
  problem: RegExp
  /** Only on these routes (their declared path); everywhere when left out. */
  routes?: RegExp
  /** Why it is not a failure. Required, so that an exception never goes unexplained. */
  reason: string
}

/** How long the walk waits, in milliseconds. */
export interface RouteWalkTimings {
  /** For the app to render its `main`. */
  app: number
  /** For the card loaders to finish, once the page has settled. */
  loader: number
  /** How long no API request, script or style may be running before the page counts as loaded. */
  quiet: number
  /** How long a page that keeps requesting (autorefresh) is waited for. */
  settleLimit: number
  /**
   * An API request that takes this long, answered or not, is a problem: it hung, or its client gave up on it (the
   * clients time out at 15–30 s).
   */
  slowRequest: number
}

/**
 * The admin's own `test` and `expect` from `@playwright/test`. The walk does not import Playwright Test: an admin
 * keeps it in its e2e project, out of reach of this package, and a second copy in one run fails.
 */
export interface RouteWalkPlaywright {
  test: TestType<PlaywrightTestArgs & PlaywrightTestOptions, PlaywrightWorkerArgs & PlaywrightWorkerOptions>
  expect: Expect
}

export interface RouteWalkOptions {
  /** Title of the describe block, e.g. `ADMIN-CMS (LOCAL) - Routes`. */
  title: string
  /** The app's `src/typed-router.d.ts`. */
  declarationFile: string
  /** The app's `src/pages`. The declaration must hold one route per page file but the catch-all. */
  pagesDir: string
  /** Logs the worker's page in. The page has the project's `baseURL`. */
  login: (page: Page) => Promise<void>
  /** Routes not opened at all, by declared path, with the reason. */
  skip?: Record<string, string>
  /**
   * Routes not opened while a condition holds, e.g. a system the app's `config.json` disables: its routes
   * send the visitor to `/unauthorized` by design.
   */
  skipIf?: { routes: RegExp; reason: string; when: (page: Page) => Promise<boolean> }[]
  /** Values of parameters by name, used wherever the parameter appears (e.g. `{ system: 'cms' }`). */
  params?: Record<string, string>
  /**
   * Routes whose address cannot come from a listing, by declared path: returns the path to open, or
   * `undefined` when there is no record to open (the route is skipped, as for an empty listing).
   */
  resolve?: Record<string, (page: Page) => Promise<string | undefined>>
  /**
   * Routes whose listing cannot give a record, by declared path, with the reason: the address before the
   * parameter is not a page, or its rows open something else. Any other such route fails. An empty listing
   * only skips its routes, since what a listing holds depends on the environment's data.
   */
  noRecord?: Record<string, string>
  /**
   * Routes that forward by design, by declared path: where they may land (a pathname pattern). Landing
   * anywhere but the address opened fails any other route, so a page that gives up and goes back is seen.
   */
  redirects?: Record<string, RegExp>
  /** Problems that do not fail a route. */
  ignore?: RouteWalkIgnore[]
  /**
   * Problems that do not fail a route on the local Docker stack only (`E2E_ENV=local`): what the stack does not
   * run, e.g. a mailer or an analytics service. On devel and staging they are failures.
   */
  localIgnore?: RouteWalkIgnore[]
  /** The rows of a listing, clicked to find a record when no link to one is found. Default: Vuetify's data table. */
  rowSelector?: string
  /**
   * Requests that stay open for the whole session, e.g. a server-sent event stream: neither waited for nor
   * checked. Default: a notification stream (`/notifications/stream/`).
   */
  openRequests?: RegExp
  /**
   * Where the app sends a visitor it cannot serve. The boot check must not end on one of them.
   * Default: `/unauthorized`, `/error` and `/login`.
   */
  problemPages?: string[]
  /** Overrides of `DEFAULT_TIMINGS`. */
  timings?: Partial<RouteWalkTimings>
  /**
   * Timings of single routes, by declared path, over `timings`, with the reason: a page known to be slow gets
   * more time without every route getting it.
   */
  routeTimings?: Record<string, { timings: Partial<RouteWalkTimings>; reason: string }>
}

/** What a page did while the walk watched it. */
export interface PageWatcher {
  /** Forgets everything seen so far, before the next page; `slowRequest` for that page, else the watcher's own. */
  reset(options?: { slowRequest?: number }): void
  push(problem: RouteWalkProblem): void
  /**
   * The problems, once each: common-admin's `Api error: <url> …` and Chromium's "Failed to load resource" repeat a
   * failed response the walk reports itself, so they are kept only for a url no response accounts for.
   */
  problems(): RouteWalkProblem[]
  /** API requests answered with a success. */
  readonly apiAnswered: number
  /** When an API request, script or style last started or ended (ms since the epoch); 0 after `reset`. */
  readonly lastActivity: number
  /** The API requests, scripts and styles still running, with when they started. */
  readonly inFlight: ReadonlyMap<Request, number>
}

export interface RouteVisit {
  /** Whether no request was running at the end; a page that keeps requesting does not settle. */
  settled: boolean
  /** The pathname the page ended on. */
  landedOn: string
  problems: RouteWalkProblem[]
  apiAnswered: number
}

export type RecordLookup = { id: string } | { missing: string; empty?: true }

// The walk's functions, declared once: `routeWalk.d.mts` exports them by these types, and `routeWalk.mjs` gives
// each its type, so that the type check holds the code to its declaration.

export type ReadDeclaredRoutes = (declarationFile: string) => string[]

export type DefineRouteWalk = (playwright: RouteWalkPlaywright, options: RouteWalkOptions) => void

export type WatchPage = (
  page: Page,
  options?: { openRequests?: RegExp; timings?: Partial<RouteWalkTimings> }
) => PageWatcher

export type VisitRoute = (
  page: Page,
  watcher: PageWatcher,
  target: string,
  options?: { redirect?: RegExp; timings?: Partial<RouteWalkTimings> }
) => Promise<RouteVisit>

export type FirstRecordOf = (
  page: Page,
  watcher: PageWatcher,
  listing: string,
  pattern: RegExp,
  options: { outputDir: string; rowSelector?: string; timings?: Partial<RouteWalkTimings> }
) => Promise<RecordLookup>
