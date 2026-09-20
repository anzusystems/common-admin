import type { ESLint, Linter } from 'eslint'

/**
 * Types for the plugin, which is javascript because eslint loads it directly from `src`. Written by
 * hand rather than generated, so it says what the plugin offers rather than what it happens to
 * return: a consumer that imports it gets a typed plugin, and the rule tests can import it at all.
 */
export declare const anzuPlugin: ESLint.Plugin

/** Names that are deprecated wherever they are imported from. */
export declare const DEFAULT_DEPRECATED_IMPORTS: readonly string[]

/** Deprecated names grouped by the module they come from, for use inside this library. */
export declare const DEFAULT_INTERNAL_DEPRECATED_IMPORTS: readonly { path: string; imports: readonly string[] }[]

/** One flat-config block: the plugin plus the rule severities the options ask for. */
export declare function recommended(options?: Record<string, unknown>): {
  plugins: Record<string, ESLint.Plugin>
  rules: Linter.RulesRecord
}
