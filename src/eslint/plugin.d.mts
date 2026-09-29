import type { ESLint, Linter } from 'eslint'

/**
 * Types for the plugin, which is javascript because eslint loads it directly from `src`. Written by
 * hand rather than generated, so it says what the plugin offers rather than what it happens to
 * return: a consumer that imports it gets a typed plugin, and the rule tests can import it at all.
 */
export declare const anzuPlugin: ESLint.Plugin

type Severity = boolean | 'error' | 'warn' | 'off'

export interface RecommendedOptions {
  noTsExtension?: Severity
  preferApiCommand?: Severity
  preferApiFetchItems?: Severity
  urlParamsMatchTemplate?: Severity
  /** @deprecated The rule is gone with the helpers it guarded; the option is ignored. */
  deprecatedImports?: Severity
}

/** One flat-config block: the plugin plus the rule severities the options ask for. */
export declare function recommended(options?: RecommendedOptions): {
  plugins: Record<string, ESLint.Plugin>
  rules: Linter.RulesRecord
}

export interface AnzuAdminEslintOptions {
  /**
   * The admin's `import.meta.url` (of its eslint.config.mjs), or that file's path; everything below
   * resolves against it.
   */
  root: string | URL
  /** Default `.oxlintrc.json`; its enabled rules are switched off in eslint. `false` skips that. */
  oxlintConfig?: string | false
  /** Default `src/typed-router.d.ts`, read by `anzu/valid-route-name`. */
  typedRouter?: string
  /** More globally registered components for `vue/no-undef-components` (inhouse: the `GMap*` family). */
  globalComponents?: string[]
  /** Added to the ignored paths. */
  ignores?: string[]
  /** Default `'error'`. */
  noExplicitAny?: 'error' | 'warn' | 'off'
  /** Severities of the anzu rules. */
  anzu?: RecommendedOptions & { validRouteName?: Severity }
  /**
   * `configureVueProject()` of `@vue/eslint-config-typescript`, applied by the preset. `rootDir`
   * defaults to the admin's directory.
   */
  vueProject?: {
    scriptLangs?: string[]
    tsSyntaxInTemplates?: boolean
    allowComponentTypeUnsafety?: boolean
    rootDir?: string
    includeDotFolders?: boolean
  }
}

/** The whole eslint config of an admin; `extra` configs come last. */
export declare function defineAnzuAdminConfig(
  options: AnzuAdminEslintOptions,
  ...extra: Linter.Config[]
): Promise<Linter.Config[]>

export { globalComponentNames } from './globalComponentNames.mjs'
