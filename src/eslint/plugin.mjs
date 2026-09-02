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

        // Index rules by the module specifier they match, so one import is
        // resolved by a single Map lookup instead of scanning every rule.
        const rulesBySource = new Map()
        for (const rule of deprecationRules) {
          const matchPath = rule.path || rule.module
          if (!matchPath) continue
          const entry = { matchPath, imports: new Set(rule.imports) }
          const existing = rulesBySource.get(matchPath)
          if (existing) existing.push(entry)
          else rulesBySource.set(matchPath, [entry])
        }

        // Skipping depends only on the file name, so resolve it once per file
        // instead of once per import declaration.
        let fileSkipped = null
        const isFileSkipped = () => {
          if (fileSkipped !== null) return fileSkipped
          const normalizedFilename = context.filename.replace(/\\/g, '/')
          fileSkipped =
            skipFiles.some((skip) => normalizedFilename.endsWith(skip)) ||
            ruleFilePaths.some(
              (rulePath) =>
                normalizedFilename.endsWith(rulePath + '.ts') ||
                normalizedFilename.endsWith(rulePath + '.js') ||
                normalizedFilename.endsWith(rulePath + '.vue') ||
                normalizedFilename.endsWith(rulePath),
            )
          return fileSkipped
        }

        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (typeof source !== 'string') return

            const entries = rulesBySource.get(source)
            if (!entries) return
            if (isFileSkipped()) return

            for (const { matchPath, imports } of entries) {
              for (const spec of node.specifiers) {
                if (spec.type !== 'ImportSpecifier') continue
                if (!imports.has(spec.imported.name)) continue
                context.report({
                  node: spec,
                  message: `'${spec.imported.name}' from '${matchPath}' is deprecated`,
                })
              }
            }
          },
        }
      },
    },

    'url-params-match-template': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Ensure urlParams keys match the :placeholders declared in urlTemplate ' +
            'for useApiRequest / useApiFetchList / useApiFetchByIds / useApiFetchListBatch calls.',
        },
        schema: [],
      },
      create(context) {
        const TARGET_CALLEES = new Set([
          'useApiRequest',
          'useApiFetchList',
          'useApiFetchByIds',
          'useApiFetchListBatch',
        ])

        const PLACEHOLDER_RE = /:([a-zA-Z_][\w]*)/g

        const getCalleeName = (callee) => {
          if (callee.type === 'Identifier') return callee.name
          if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
            return callee.property.name
          }
          return null
        }

        const findProperty = (objectExpr, name) => {
          for (const prop of objectExpr.properties) {
            if (prop.type !== 'Property' || prop.computed) continue
            const key = prop.key
            const keyName =
              key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null
            if (keyName === name) return prop
          }
          return null
        }

        const resolveIdentifierToString = (identNode) => {
          const scope = context.sourceCode.getScope(identNode)
          let cur = scope
          while (cur) {
            const variable = cur.variables.find((v) => v.name === identNode.name)
            if (variable && variable.defs.length === 1) {
              const def = variable.defs[0]
              if (
                def.type === 'Variable' &&
                def.node.type === 'VariableDeclarator' &&
                def.parent &&
                def.parent.kind === 'const' &&
                def.node.init
              ) {
                return resolveToString(def.node.init)
              }
            }
            cur = cur.upper
          }
          return null
        }

        const resolveToString = (node) => {
          if (!node) return null
          if (node.type === 'Literal' && typeof node.value === 'string') return node.value
          if (node.type === 'TemplateLiteral') {
            let out = ''
            for (let i = 0; i < node.quasis.length; i++) {
              out += node.quasis[i].value.cooked
              if (i < node.expressions.length) {
                const part = resolveToString(node.expressions[i])
                if (part === null) return null
                out += part
              }
            }
            return out
          }
          if (node.type === 'BinaryExpression' && node.operator === '+') {
            const left = resolveToString(node.left)
            const right = resolveToString(node.right)
            if (left === null || right === null) return null
            return left + right
          }
          if (node.type === 'Identifier') return resolveIdentifierToString(node)
          return null
        }

        const collectStaticKeys = (objectExpr) => {
          const keys = []
          for (const prop of objectExpr.properties) {
            if (prop.type !== 'Property') return null
            if (prop.computed) return null
            const key = prop.key
            if (key.type === 'Identifier') keys.push(key.name)
            else if (key.type === 'Literal' && typeof key.value === 'string') keys.push(key.value)
            else return null
          }
          return keys
        }

        return {
          CallExpression(node) {
            const name = getCalleeName(node.callee)
            if (!name || !TARGET_CALLEES.has(name)) return

            const arg = node.arguments[0]
            if (!arg || arg.type !== 'ObjectExpression') return

            const templateProp = findProperty(arg, 'urlTemplate')
            const paramsProp = findProperty(arg, 'urlParams')
            if (!templateProp || !paramsProp) return
            if (paramsProp.value.type !== 'ObjectExpression') return

            const resolved = resolveToString(templateProp.value)
            if (resolved === null) return

            const placeholders = new Set()
            let match
            PLACEHOLDER_RE.lastIndex = 0
            while ((match = PLACEHOLDER_RE.exec(resolved)) !== null) {
              placeholders.add(match[1])
            }

            const paramKeys = collectStaticKeys(paramsProp.value)
            if (paramKeys === null) return

            const paramKeySet = new Set(paramKeys)

            for (const placeholder of placeholders) {
              if (!paramKeySet.has(placeholder)) {
                context.report({
                  node: paramsProp,
                  message:
                    `urlParams is missing key '${placeholder}' required by urlTemplate ` +
                    `'${resolved}'.`,
                })
              }
            }

            for (const key of paramKeys) {
              if (!placeholders.has(key)) {
                context.report({
                  node: paramsProp,
                  message:
                    `urlParams key '${key}' has no matching ':${key}' placeholder in urlTemplate ` +
                    `'${resolved}'.`,
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
              (part) => part.type === 'CallExpression' && part.callee.name === 'isAnzuFatalError',
            )
            const hasInstanceofErrorCheck = parts.some(
              (part) =>
                part.type === 'BinaryExpression' &&
                part.operator === 'instanceof' &&
                part.right.type === 'Identifier' &&
                part.right.name === 'Error',
            )
            const hasAxiosCheck = parts.some(
              (part) =>
                part.type === 'CallExpression' &&
                part.callee.type === 'MemberExpression' &&
                part.callee.object.name === 'axios' &&
                part.callee.property.name === 'isAxiosError',
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
    urlParamsMatchTemplate = 'error',
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

  // url-params-match-template
  const urlParamsSeverity = normalizeSeverity(urlParamsMatchTemplate)
  if (urlParamsSeverity) {
    rules['anzu/url-params-match-template'] = urlParamsSeverity
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
