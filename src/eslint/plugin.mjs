const DEFAULT_DEPRECATED_IMPORTS = [
  'AFilterWrapper',
  'AFilterBooleanSelect',
  'AFilterBooleanGroup',
  'AFilterDatetimePicker',
  'AFilterInteger',
  'AFilterRemoteAutocomplete',
  'AFilterRemoteAutocompleteWithMinimal',
  'AFilterString',
  'AFilterValueObjectOptionsSelect',
  'ADatatableOrdering',
  'ADatatablePagination',
  'AFormRemoteAutocomplete',
  'ASubjectSelect',
  'usePagination',
  'useFilterHelpers',
  'createDatatableColumnsConfig',
  'useSubjectSelect',
  'useApiQueryBuilder',
  'useJobApi',
  'Pagination',
  'makeFilterHelper',
  'apiFetchList',
  'FilterBag',
  'Filter',
  'apiFetchByIds',
  'apiAnyRequest',
  'apiCreateOne',
  'apiDeleteOne',
  'apiFetchOne',
  'apiUpdateOne',
]

const DEFAULT_INTERNAL_DEPRECATED_IMPORTS = [
  {
    path: '@/services/api/apiFetchList',
    imports: ['apiFetchList'],
  },
  {
    path: '@/services/api/apiFetchListBatch',
    imports: ['apiFetchListBatch'],
  },
  {
    path: '@/composables/system/pagination',
    imports: ['usePagination', 'Pagination'],
  },
  {
    path: '@/composables/filter/filterHelpers',
    imports: ['useFilterHelpers', 'makeFilterHelper'],
  },
  {
    path: '@/composables/system/datatableColumns',
    imports: ['createDatatableColumnsConfig'],
  },
  {
    path: '@/components/subjectSelect/useSubjectSelect',
    imports: ['useSubjectSelect'],
  },
  {
    path: '@/services/api/queryBuilder',
    imports: ['useApiQueryBuilder'],
  },
  {
    path: '@/services/api/job/jobApi',
    imports: ['useJobApi'],
  },
  {
    path: '@/types/Filter',
    imports: ['FilterBag', 'Filter'],
  },
  {
    path: '@/components/filter/AFilterWrapper',
    imports: ['AFilterWrapper'],
  },
  {
    path: '@/components/filter/AFilterBooleanSelect',
    imports: ['AFilterBooleanSelect'],
  },
  {
    path: '@/components/filter/AFilterBooleanGroup',
    imports: ['AFilterBooleanGroup'],
  },
  {
    path: '@/components/filter/AFilterDatetimePicker',
    imports: ['AFilterDatetimePicker'],
  },
  {
    path: '@/components/filter/AFilterInteger',
    imports: ['AFilterInteger'],
  },
  {
    path: '@/components/filter/AFilterRemoteAutocomplete',
    imports: ['AFilterRemoteAutocomplete'],
  },
  {
    path: '@/components/filter/AFilterRemoteAutocompleteWithMinimal',
    imports: ['AFilterRemoteAutocompleteWithMinimal'],
  },
  {
    path: '@/components/filter/AFilterString',
    imports: ['AFilterString'],
  },
  {
    path: '@/components/filter/AFilterValueObjectOptionsSelect',
    imports: ['AFilterValueObjectOptionsSelect'],
  },
  {
    path: '@/components/ADatatableOrdering',
    imports: ['ADatatableOrdering'],
  },
  {
    path: '@/components/ADatatablePagination',
    imports: ['ADatatablePagination'],
  },
  {
    path: '@/components/form/AFormRemoteAutocomplete',
    imports: ['AFormRemoteAutocomplete'],
  },
  {
    path: '@/components/subjectSelect/ASubjectSelect',
    imports: ['ASubjectSelect'],
  },
]

const anzuPlugin = {
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
                    module: { type: 'string' },
                    imports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['imports'],
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

        // Collect source file paths from path-based rules for auto-skip
        const ruleFilePaths = deprecationRules
          .filter((rule) => rule.path)
          .map((rule) => {
            if (rule.path.startsWith('@/')) {
              return rule.path.replace('@/', 'src/')
            }
            return rule.path
          })

        return {
          ImportDeclaration(node) {
            const filename = context.filename
            const normalizedFilename = filename.replace(/\\/g, '/')

            // Check manual skip list
            if (skipFiles.some((skip) => normalizedFilename.endsWith(skip))) return

            // Auto-skip source files of path-based rules
            if (
              ruleFilePaths.some(
                (rulePath) =>
                  normalizedFilename.endsWith(rulePath + '.ts') ||
                  normalizedFilename.endsWith(rulePath + '.js') ||
                  normalizedFilename.endsWith(rulePath + '.vue') ||
                  normalizedFilename.endsWith(rulePath)
              )
            ) return

            const source = node.source.value
            if (typeof source !== 'string') return

            for (const rule of deprecationRules) {
              const matchPath = rule.path || rule.module
              if (!matchPath || source !== matchPath) continue

              const deprecatedImports = node.specifiers
                .filter((spec) => spec.type === 'ImportSpecifier')
                .filter((spec) => rule.imports.includes(spec.imported.name))

              for (const importSpec of deprecatedImports) {
                context.report({
                  node: importSpec,
                  message: `'${importSpec.imported.name}' from '${matchPath}' is deprecated`,
                })
              }
            }
          },
        }
      },
    },

    'no-fatal-error-axios-check': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow isAnzuFatalError + axios.isAxiosError(error.cause) pattern.' +
            ' Labs API throws AnzuApiAxiosError instead.',
        },
        schema: [],
      },
      create(context) {
        return {
          LogicalExpression(node) {
            if (node.operator !== '&&') return
            if (node.parent.type === 'LogicalExpression' && node.parent.operator === '&&') return

            const parts = []
            let current = node
            while (current.type === 'LogicalExpression' && current.operator === '&&') {
              parts.unshift(current.right)
              current = current.left
            }
            parts.unshift(current)

            const hasFatalCheck = parts.some(
              (part) => part.type === 'CallExpression' && part.callee.name === 'isAnzuFatalError'
            )
            const hasInstanceofErrorCheck = parts.some(
              (part) =>
                part.type === 'BinaryExpression' &&
                part.operator === 'instanceof' &&
                part.right.type === 'Identifier' &&
                part.right.name === 'Error'
            )
            const hasAxiosCheck = parts.some(
              (part) =>
                part.type === 'CallExpression' &&
                part.callee.type === 'MemberExpression' &&
                part.callee.object.name === 'axios' &&
                part.callee.property.name === 'isAxiosError'
            )

            if (hasAxiosCheck && (hasFatalCheck || hasInstanceofErrorCheck)) {
              context.report({
                node,
                message:
                  'Replace error type check && axios.isAxiosError(error.cause)' +
                  ' with isAnzuApiAxiosError(error).' +
                  ' Labs API throws AnzuApiAxiosError with typed AxiosError cause.',
              })
            }
          },
        }
      },
    },
  },
}

/**
 * Creates an ESLint flat config entry for Anzu rules.
 *
 * @param {Object} [options]
 * @param {boolean|'error'|'warn'|'off'} [options.noTsExtension='error'] - Severity for no-ts-extension rule.
 * @param {boolean|'error'|'warn'|'off'} [options.noFatalErrorAxiosCheck='error']
 *   - Severity for no-fatal-error-axios-check rule.
 * @param {boolean|'error'|'warn'|'off'|Object} [options.deprecatedImports='error'] - Severity or config object.
 * @param {string[]} [options.deprecatedImports.exclude] - Import names to remove from the default list.
 * @param {string[]} [options.deprecatedImports.include] - Additional import names to add to the default list.
 * @param {Array} [options.deprecatedImports.extraRules]
 *   - Additional rule entries ({ path, imports } or { module, imports }).
 * @param {string[]} [options.deprecatedImports.skipFiles] - Files to skip (matched by suffix).
 * @param {'error'|'warn'} [options.deprecatedImports.severity='error'] - Severity level.
 * @param {'consumer'|'internal'} [options.deprecatedImports.mode='consumer'] - 'consumer' uses module-based defaults,
 *   'internal' uses path-based defaults for common-admin development.
 * @returns {Object} ESLint flat config entry
 */
export function recommended(options = {}) {
  const {
    noTsExtension = 'error',
    noFatalErrorAxiosCheck = 'error',
    deprecatedImports = 'error',
  } = options

  const rules = {}

  // no-ts-extension
  const tsExtSeverity = normalizeSeverity(noTsExtension)
  if (tsExtSeverity) {
    rules['anzu/no-ts-extension'] = tsExtSeverity
  }

  // no-fatal-error-axios-check
  const fatalSeverity = normalizeSeverity(noFatalErrorAxiosCheck)
  if (fatalSeverity) {
    rules['anzu/no-fatal-error-axios-check'] = fatalSeverity
  }

  // no-deprecated-imports
  if (deprecatedImports !== false && deprecatedImports !== 'off') {
    let severity = 'error'
    const ruleEntries = []
    let skipFiles = []

    if (typeof deprecatedImports === 'object') {
      severity = deprecatedImports.severity || 'error'
      const mode = deprecatedImports.mode || 'consumer'

      if (mode === 'internal') {
        // Internal mode: path-based rules for common-admin development
        ruleEntries.push(...DEFAULT_INTERNAL_DEPRECATED_IMPORTS)
      } else {
        // Consumer mode: module-based rules for projects using common-admin
        let importsList = [...DEFAULT_DEPRECATED_IMPORTS]
        if (deprecatedImports.exclude) {
          importsList = importsList.filter((name) => !deprecatedImports.exclude.includes(name))
        }
        if (deprecatedImports.include) {
          importsList.push(...deprecatedImports.include)
        }
        ruleEntries.push({
          module: '@anzusystems/common-admin',
          imports: importsList,
        })
      }

      if (deprecatedImports.extraRules) {
        ruleEntries.push(...deprecatedImports.extraRules)
      }
      if (deprecatedImports.skipFiles) {
        skipFiles = deprecatedImports.skipFiles
      }
    } else {
      if (deprecatedImports === 'warn') {
        severity = 'warn'
      }
      // Default consumer mode
      ruleEntries.push({
        module: '@anzusystems/common-admin',
        imports: [...DEFAULT_DEPRECATED_IMPORTS],
      })
    }

    const ruleConfig = { rules: ruleEntries }
    if (skipFiles.length > 0) {
      ruleConfig.skipFiles = skipFiles
    }

    rules['anzu/no-deprecated-imports'] = [severity, ruleConfig]
  }

  return {
    plugins: {
      anzu: anzuPlugin,
    },
    rules,
  }
}

function normalizeSeverity(value) {
  if (value === false || value === 'off') return null
  if (value === true || value === 'error') return 'error'
  if (value === 'warn') return 'warn'
  return 'error'
}

export { anzuPlugin, DEFAULT_DEPRECATED_IMPORTS, DEFAULT_INTERNAL_DEPRECATED_IMPORTS }
