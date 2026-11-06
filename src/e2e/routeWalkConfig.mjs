// @ts-check

/**
 * The Playwright config of the route walk (`tests/routes`, run by `bin/test --routes`), made from the admin's own
 * `playwright.config.ts`: the same env, URL and browser, with what the walk needs over it.
 */

/** @type {import('./routeWalkConfig.mjs').DefineRouteWalkConfig} */
export function defineRouteWalkConfig(base, overrides = {}) {
  const { use: ownUse, ...own } = overrides
  // A local stack serves the app over plain http, where the browser withholds what needs a secure context
  // (`crypto.randomUUID` and the like). Deployed, the app is served over https.
  const baseURL = ownUse?.baseURL ?? base.use?.baseURL ?? process.env.BASE_URL
  const origin = baseURL ? new URL(baseURL).origin : ''
  const use = { ...base.use, ...ownUse }
  // A config that already passes the flag (admin-dam's names admin-cms's origin too) keeps its own: Chromium reads
  // only one of them.
  const hasOwnFlag = (use.launchOptions?.args ?? []).some((arg) =>
    arg.startsWith('--unsafely-treat-insecure-origin-as-secure=')
  )
  const secureContextArgs =
    origin.startsWith('http:') && !hasOwnFlag ? [`--unsafely-treat-insecure-origin-as-secure=${origin}`] : []

  return {
    ...base,
    // Relative paths are resolved against the config file's folder.
    testDir: 'tests/routes',
    // The default run leaves the walk out (`testIgnore`, or projects with folders of their own).
    testIgnore: [],
    // A route is only opened, nothing is clicked or typed, so the routes are spread over workers.
    workers: 4,
    retries: 0,
    // Folders of its own: a run empties its outputDir, and the walk would wipe the last suite run's traces.
    reporter: [['list'], ['html', { outputFolder: '.report-routes', open: 'never' }]],
    outputDir: '.results-routes',
    ...own,
    use: {
      ...use,
      // The headless shell Playwright uses by default ignores the flag; full Chromium in headless mode honours it.
      ...(secureContextArgs.length ? { channel: 'chromium' } : {}),
      launchOptions: {
        ...use.launchOptions,
        args: [...(use.launchOptions?.args ?? []), ...secureContextArgs],
      },
    },
    projects: [
      { name: 'boot', testMatch: /boot\.spec\.ts$/ },
      // An app that does not boot stops the walk here instead of failing each route after its timeout.
      { name: 'routes', testMatch: /routes\.spec\.ts$/, dependencies: ['boot'] },
    ],
  }
}
