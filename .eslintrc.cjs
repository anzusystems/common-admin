/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
    'plugin:vue/vue3-recommended'
  ],
  env: {
    'vue/setup-compiler-macros': true,
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    'vue/script-setup-uses-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
    semi: ['error', 'never'],
    quotes: ['error', 'single', 'avoid-escape'],
    'vue/multi-word-component-names': [
      'error',
      {
        ignores: ['Acl'],
      },
    ],
  },
  parserOptions: {
    ecmaVersion: 'latest'
  }
}
