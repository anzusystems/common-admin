import type { SentryVitePluginOptions } from '@sentry/vite-plugin'
import type { Plugin, PluginOption } from 'vite'

export interface AnzuSentryOptions extends Omit<SentryVitePluginOptions, 'project' | 'org'> {
  /** Sentry project slug, e.g. `anzu-admin-cms`. */
  project: string
  /** Sentry organization slug. Defaults to `petitpress`. */
  org?: string
}

/**
 * Sentry release and source map upload for an admin build, enabled when `APP_DEPLOY_ENV` and
 * `SENTRY_URL` are set. Put it first in `plugins`: `plugins: [...anzuSentry({ project }), vue(), …]`.
 * Options other than `project` and `org` override the defaults passed to `sentryVitePlugin`;
 * `release` and `sourcemaps` are merged into them.
 */
export declare function anzuSentry(options: AnzuSentryOptions): PluginOption[]

/** Chains the source maps common-admin publishes into the admin's build (only when it emits maps). */
export declare function commonAdminSourcemaps(): Plugin

export interface CommonAdminDevWatchOptions {
  /** Relative to the admin's root. Defaults to `.common-admin-updated`, which `copy.sh` and `yarn dev:admin` write. */
  triggerFile?: string
  /**
   * `false`: common-admin is left out of the dependency pre-bundling (its files are served one by one:
   * a dozen with `yarn dev:admin`, which builds one bundle, ~800 after `./copy.sh`; the library's own
   * dependencies are pre-bundled for it, except what the admin excludes itself), so an update from
   * `yarn dev:admin` invalidates the changed files and reloads the page instead of restarting the server. Defaults to
   * `true` (pre-bundled; an update restarts the server with a forced re-optimization).
   */
  prebundle?: boolean
}

/**
 * Local development against a common-admin copied into node_modules (`copy.sh`, `yarn dev:admin`):
 * reacts to `.common-admin-updated`. Does nothing in a build.
 */
export declare function commonAdminDevWatch(options?: CommonAdminDevWatchOptions): Plugin
