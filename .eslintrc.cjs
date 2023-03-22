/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
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
    semi: ['error', 'never'],
    quotes: ['error', 'single', 'avoid-escape'],
    'vue/multi-word-component-names': [
      'error',
      {
        ignores: ['Acl'],
      },
    ],
    'vue/valid-v-slot': ['error', { 'allowModifiers': true }],
    'object-curly-spacing': ['error', 'always'],
    'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1 }],
    'no-trailing-spaces': 'error',
    'comma-dangle': ['error', {
      'arrays': 'always-multiline',
      'objects': 'always-multiline',
      'imports': 'only-multiline',
      'exports': 'only-multiline',
      'functions': 'only-multiline',
    }],
    'max-len': ['error', {
      'code': 120,
      'ignoreTrailingComments': true,
      'ignoreUrls': true,
      'ignoreRegExpLiterals': true,
    }],
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
}
