import type {
  DefineRouteWalk,
  FirstRecordOf,
  ReadDeclaredRoutes,
  RouteWalkTimings,
  VisitRoute,
  WatchPage,
} from './types.mjs'

export type * from './types.mjs'

export declare const DEFAULT_TIMINGS: Readonly<RouteWalkTimings>

/** The declared paths, constraints unescaped. The catch-all is left out. */
export declare const readDeclaredRoutes: ReadDeclaredRoutes

/**
 * Registers the boot check the walk depends on (a Playwright project dependency): the app logs in, starts and
 * shows a page of its own. Without it, an app that never boots would hold every route for the full app timeout.
 * It also empties the record cache of an earlier run.
 */
export declare const defineRouteWalkBoot: DefineRouteWalk

/** Registers the walk: a guard that the declaration was read, then one test per route. */
export declare const defineRouteWalk: DefineRouteWalk

// What the walk is made of, for its tests.

/** Watches a page for what it does wrong, for the whole session of a worker. */
export declare const watchPage: WatchPage

/**
 * Opens the target on a fresh document, waits until it has loaded, and collects what it did wrong: problems the
 * watcher saw, landing elsewhere than the target (or than `redirect` allows), the 404 view, an empty page and
 * unresolved components. Throws when the app does not render or a card loader never finishes.
 */
export declare const visitRoute: VisitRoute

/**
 * The first record a listing shows: from a link to it, else by clicking the first row and reading where the
 * app went. Kept in a file in `outputDir`, so a record's detail and edit share one visit of the listing.
 */
export declare const firstRecordOf: FirstRecordOf
