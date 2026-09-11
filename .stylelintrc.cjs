module.exports = {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-recommended-vue/scss'
  ],
  rules: {
    "selector-class-pattern": "^(?:(?:o|c|u|t|s|is|has|_|js|qa)-)?[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*(?:__[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)?(?:--[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)?(?:\\[.+\\])?$",
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    "scss/double-slash-comment-whitespace-inside": null,
    "color-function-notation": ["modern", { "ignore": ["with-var-inside"] }],
    "declaration-property-value-no-unknown": null,
    // Formatting is owned by oxfmt. Keeping these on means `yarn format` can
    // produce code that `yarn ci` rejects.
    "at-rule-empty-line-before": null,
    "rule-empty-line-before": null,
    "declaration-empty-line-before": null,
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "comment-whitespace-inside": null,
    "declaration-block-single-line-max-declarations": null,
    "scss/at-else-closing-brace-newline-after": null,
    "scss/at-else-closing-brace-space-after": null,
    "scss/at-else-empty-line-before": null,
    "scss/at-else-if-parentheses-space-before": null,
    "scss/at-function-parentheses-space-before": null,
    "scss/at-if-closing-brace-newline-after": null,
    "scss/at-if-closing-brace-space-after": null,
    "scss/at-mixin-parentheses-space-before": null,
    "scss/dollar-variable-colon-space-after": null,
    "scss/dollar-variable-colon-space-before": null,
    "scss/dollar-variable-empty-line-before": null,
    "scss/double-slash-comment-empty-line-before": null,
    "scss/operator-no-newline-after": null,
    "scss/operator-no-newline-before": null,
    // scss/operator-no-unspaced stays on: `1px+2px` is a real SCSS footgun,
    // not formatting. oxfmt does not touch it.
  },
}
