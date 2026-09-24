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
