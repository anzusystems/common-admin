import { createRequire } from 'node:module'
import { resolve, sep } from 'node:path'
import { commonAdminSourcemaps } from './sourcemaps.mjs'

/**
 * `@sentry/vite-plugin` is an optional peer, and `anzuSentry()` has to hand its plugins to
 * `plugins: []` synchronously, so a lazy `import()` is not an option.
 */
function loadSentryVitePlugin() {
  try {
    return createRequire(import.meta.url)('@sentry/vite-plugin').sentryVitePlugin
  } catch (error) {
    throw new Error(
      'anzuSentry: Sentry is enabled (APP_DEPLOY_ENV and SENTRY_URL are set), but @sentry/vite-plugin ' +
        'cannot be loaded. Add it to the devDependencies of the admin.',
      { cause: error }
    )
  }
}

/**
 * Sentry build setup shared by the admins: release, source map upload,
 * and the library's maps chained in (see `commonAdminSourcemaps`).
 * Enabled when `APP_DEPLOY_ENV` and `SENTRY_URL` are set. The build then emits `hidden` source
 * maps, uploads them and deletes them from the output, so they never reach the deployed site.
 * A missing token, org or project fails the build instead of warning, and so does a failed upload.
 */
export function anzuSentry({ project, org = 'petitpress', release, sourcemaps, ...overrides }) {
  const env = process.env
  const enabled = !!env.APP_DEPLOY_ENV && !!env.SENTRY_URL
  if (!enabled) return [commonAdminSourcemaps()]

  const authToken = overrides.authToken ?? env.SENTRY_AUTH_TOKEN
  const missing = Object.entries({ SENTRY_AUTH_TOKEN: authToken, org, project })
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`anzuSentry: Sentry is enabled, but ${missing.join(', ')} is empty.`)
  }

  const sentryVitePlugin = loadSentryVitePlugin()
  // The upload runs in the output directory, but a relative glob matches
  // against the working directory. Derive it from the resolved `build.outDir`.
  let resolveOutDir
  const filesToDeleteAfterUpload = new Promise((resolveGlob) => {
    resolveOutDir = (outDir) => resolveGlob(`${outDir.split(sep).join('/')}/**/*.js.map`)
  })

  return [
    commonAdminSourcemaps(),
    {
      name: 'anzu:sentry-config',
      apply: 'build',
      config() {
        return { build: { sourcemap: 'hidden' } }
      },
      configResolved(config) {
        resolveOutDir(resolve(config.root, config.build.outDir))
      },
    },
    ...sentryVitePlugin({
      url: env.SENTRY_URL,
      authToken,
      org,
      project,
      telemetry: false,
      errorHandler: (error) => {
        throw error
      },
      ...overrides,
      release: { name: env.GITVAR_SHORTVERSION, ...release },
      sourcemaps: { filesToDeleteAfterUpload, ...sourcemaps },
    }),
  ]
}
