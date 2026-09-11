import { anzuPlugin } from './plugin.mjs'

/**
 * Oxlint entry point for the Anzu rules.
 *
 * The rules operate on the standard ESTree AST, so oxlint runs them through its
 * JS plugin bridge with output identical to ESLint - including .vue <script>
 * blocks, scope analysis and autofix.
 *
 * Usage in .oxlintrc.json:
 *
 *   {
 *     "jsPlugins": ["@anzusystems/common-admin/oxlint"],
 *     "rules": {
 *       "anzu/no-ts-extension": "error",
 *       "anzu/no-fatal-error-axios-check": "error",
 *       "anzu/url-params-match-template": "error",
 *       "anzu/no-deprecated-imports": ["error", { "rules": [...] }]
 *     }
 *   }
 *
 * When these are enabled here, turn them off in eslint.config.mjs - oxlint's
 * `buildFromOxlintConfigFile` does not know about third-party rule names.
 *
 * NOTE: oxlint JS plugins are alpha and not subject to semver.
 */
export default {
  meta: { name: 'anzu' },
  rules: anzuPlugin.rules,
}
