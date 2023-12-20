/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  plugins: [
    '@stylistic',
  ],
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
    'plugin:vue/vue3-recommended',
  ],
  env: {
    'vue/setup-compiler-macros': true,
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    'vue/script-setup-uses-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@stylistic/semi': ['error', 'never'],
    '@stylistic/quotes': ['error', 'single', 'avoid-escape'],
    'vue/multi-word-component-names': [
      'error',
      {
        ignores: ['Acl'],
      },
    ],
    'vue/valid-v-slot': ['error', { 'allowModifiers': true }],
    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1 }],
    '@stylistic/no-trailing-spaces': 'error',
    '@stylistic/comma-dangle': ['error', 'only-multiline'],
    '@stylistic/max-len': ['error', {
      'code': 120,
      'ignoreTrailingComments': true,
      'ignoreUrls': true,
      'ignoreRegExpLiterals': true,
      'ignorePattern': '^import .*',
    }],
    'vue/no-template-target-blank': ['error'],
    'vue/block-order': ['error', { 'order': [['script', 'template'], 'style'] }],
    'vue/define-macros-order': ['error'],
    'vue/component-name-in-template-casing': ['error'],
    'vue/component-api-style': ['error'],
    'vue/prefer-define-options': ['error'],
    'vue/require-typed-ref': ['error'],
    'vue/no-setup-props-reactivity-loss': ['error'],
    'vue/no-ref-object-reactivity-loss': ['error'],
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
  ignorePatterns: ['/docs/**/*'],
}
