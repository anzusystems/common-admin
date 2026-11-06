import type { PlaywrightTestConfig } from 'playwright/test'

export type DefineRouteWalkConfig = (
  base: PlaywrightTestConfig,
  overrides?: PlaywrightTestConfig
) => PlaywrightTestConfig

/**
 * The route walk's Playwright config over the admin's `playwright.config.ts`: `tests/routes`, 4 workers, no
 * retries, reports in `.report-routes` and `.results-routes` (the suite's `.report` and `.results` are left
 * alone), the boot check before the routes, and, for an http `BASE_URL`, Chromium told to treat that origin as
 * secure. `overrides` go over all of it but the projects, e.g. a `globalSetup` or `globalTimeout` of its own.
 *
 * `export default defineRouteWalkConfig(base)` in `playwright.routes.config.ts`, next to `playwright.config.ts`.
 */
export declare const defineRouteWalkConfig: DefineRouteWalkConfig
