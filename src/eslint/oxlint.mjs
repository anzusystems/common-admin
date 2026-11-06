import { anzuPlugin } from './plugin.mjs'

/**
 * Oxlint entry point for the Anzu rules. The rules use the standard ESTree AST, so oxlint runs them
 * through its JS plugin bridge with the same output as ESLint, including `.vue` script blocks and autofix.
 * @example .oxlintrc.json: { "jsPlugins": ["@anzusystems/common-admin/oxlint"], "rules":
 * { "anzu/no-ts-extension": "error", "anzu/url-params-match-template": "error" } }
 * When enabled here, turn them off in eslint.config.mjs.
 * `buildFromOxlintConfigFile` does not know third-party rule names.
 * Oxlint JS plugins are alpha and not covered by semver.
 */
export default {
  meta: { name: 'anzu' },
  rules: anzuPlugin.rules,
}
