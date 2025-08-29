import stylistic from '@stylistic/eslint-plugin'
// import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

const tsExtensionPlugin = {
  rules: {
    'no-ts-extension': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow .ts extension in import statements',
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (typeof source === 'string' && source.endsWith('.ts')) {
              context.report({
                node,
                message: 'Do not include .ts extension in import paths',
                fix(fixer) {
                  const sourceText = node.source.raw
                  const newSource = sourceText.replace(/\.ts(['"])$/, '$1')
                  return fixer.replaceText(node.source, newSource)
                },
              })
            }
          },
        }
      },
    },
  },
}

const deprecationPlugin = {
  rules: {
    'no-deprecated-imports': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow usage of deprecated imports',
        },
        schema: [
          {
            type: 'object',
            properties: {
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    imports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    level: {
                      type: 'string',
                      enum: ['error', 'warn'],
                    },
                  },
                  required: ['path', 'imports'],
                  additionalProperties: false,
                },
              },
              skipFiles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const options = context.options[0] || {}
        const deprecationRules = options.rules || []
        const skipFiles = options.skipFiles || []

        // Collect all file paths from rules configuration
        const ruleFilePaths = deprecationRules.map(rule => {
          // Convert @/ to src/ for file path matching
          if (rule.path.startsWith('@/')) {
            return rule.path.replace('@/', 'src/')
          }
          return rule.path
        })

        return {
          ImportDeclaration(node) {
            const filename = context.getFilename()
            const normalizedFilename = filename.replace(/\\/g, '/') // Handle Windows paths

            // Check if current file should be skipped (manual skip list)
            const shouldSkipManual = skipFiles.some(skipPattern => {
              return filename === skipPattern || filename.endsWith(skipPattern)
            })

            if (shouldSkipManual) return

            // Check if current file is one of the source files from rules
            const isSourceFile = ruleFilePaths.some(rulePath => {
              return normalizedFilename.endsWith(rulePath + '.ts') ||
                     normalizedFilename.endsWith(rulePath + '.js') ||
                     normalizedFilename.endsWith(rulePath + '.vue') ||
                     normalizedFilename.endsWith(rulePath)
            })

            if (isSourceFile) return

            const source = node.source.value
            if (typeof source !== 'string') return

            for (const rule of deprecationRules) {
              if (source === rule.path) {
                const deprecatedImports = node.specifiers
                  .filter((spec) => spec.type === 'ImportSpecifier')
                  .filter((spec) => rule.imports.includes(spec.imported.name))

                for (const importSpec of deprecatedImports) {
                  const message = `'${importSpec.imported.name}' from '${rule.path}' is deprecated`

                  context.report({
                    node: importSpec,
                    message,
                  })
                }
              }
            }
          },
        }
      },
    },
  },
}

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '.stylelintrc.cjs', '**/cypress/**', '**/docs/**'],
  },
  pluginVue.configs['flat/essential'],
  pluginVue.configs['flat/strongly-recommended'],
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    plugins: {
      'ts-extension': tsExtensionPlugin,
      deprecation: deprecationPlugin,
    },
    rules: {
      'ts-extension/no-ts-extension': 'error',
      'deprecation/no-deprecated-imports': [
        'error',
        {
          skipFiles: ['src/lib.ts'],
          rules: [
            // API Services
            {
              path: '@/services/api/apiFetchList',
              imports: ['apiFetchList'],
              level: 'error',
            },
            {
              path: '@/services/api/apiFetchListBatch',
              imports: ['apiFetchListBatch'],
              level: 'error',
            },
            // Composables
            {
              path: '@/composables/system/pagination',
              imports: ['usePagination', 'Pagination'],
              level: 'error',
            },
            {
              path: '@/composables/filter/filterHelpers',
              imports: ['useFilterHelpers', 'makeFilterHelper'],
              level: 'error',
            },
            {
              path: '@/composables/system/datatableColumns',
              imports: ['createDatatableColumnsConfig'],
              level: 'error',
            },
            {
              path: '@/components/subjectSelect/useSubjectSelect',
              imports: ['useSubjectSelect'],
              level: 'error',
            },
            {
              path: '@/services/api/queryBuilder',
              imports: ['useApiQueryBuilder'],
              level: 'error',
            },
            {
              path: '@/labs/job/jobApi',
              imports: ['useJobApi'],
              level: 'error',
            },
            {
              path: '@/services/api/job/jobApi',
              imports: ['useJobApi'],
              level: 'error',
            },
            // Types
            {
              path: '@/types/Filter',
              imports: ['FilterBag', 'Filter'],
              level: 'error',
            },
            // Filter Components
            {
              path: '@/components/filter/AFilterWrapper',
              imports: ['AFilterWrapper'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterBooleanSelect',
              imports: ['AFilterBooleanSelect'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterBooleanGroup',
              imports: ['AFilterBooleanGroup'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterDatetimePicker',
              imports: ['AFilterDatetimePicker'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterInteger',
              imports: ['AFilterInteger'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterRemoteAutocomplete',
              imports: ['AFilterRemoteAutocomplete'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterRemoteAutocompleteWithMinimal',
              imports: ['AFilterRemoteAutocompleteWithMinimal'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterString',
              imports: ['AFilterString'],
              level: 'error',
            },
            {
              path: '@/components/filter/AFilterValueObjectOptionsSelect',
              imports: ['AFilterValueObjectOptionsSelect'],
              level: 'error',
            },
            // Datatable Components
            {
              path: '@/components/ADatatableOrdering',
              imports: ['ADatatableOrdering'],
              level: 'error',
            },
            {
              path: '@/components/ADatatablePagination',
              imports: ['ADatatablePagination'],
              level: 'error',
            },
            // Form Components
            {
              path: '@/components/form/AFormRemoteAutocomplete',
              imports: ['AFormRemoteAutocomplete'],
              level: 'error',
            },
            // Subject Select
            {
              path: '@/components/subjectSelect/ASubjectSelect',
              imports: ['ASubjectSelect'],
              level: 'error',
            },
          ],
        },
      ],
    },
  },
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: ['Acl'],
        },
      ],
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          ignoreTrailingComments: true,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
          ignorePattern: '^import .*',
        },
      ],
      'vue/no-template-target-blank': ['error'],
      'vue/block-order': ['error', { order: [['script', 'template'], 'style'] }],
      'vue/define-macros-order': ['error'],
      'vue/component-name-in-template-casing': ['error'],
      'vue/component-api-style': ['error'],
      'vue/prefer-define-options': ['error'],
      'vue/require-typed-ref': ['error'],
      'vue/no-setup-props-reactivity-loss': ['error'],
      'vue/no-ref-object-reactivity-loss': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  }
  // skipFormatting,
)
