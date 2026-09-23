// Shared by `prefer-api-command` and `prefer-api-fetch-items`: both ask the same question -- is this
// call the `useApiRequest` helper, and what did it say it answers with.
const isHelperSource = (source) =>
  typeof source === 'string' && (source.includes('labs/api/useApiRequest') || source === '@anzusystems/common-admin')

// Resolved through the scope rather than matched by name. Matching the name fires on anyone
// else's function called `useApiRequest` and on a parameter that shadows the import inside
// one function, and stays silent when the real helper is imported under another name.
const isHelperBinding = (context, node) => {
  let scope = context.sourceCode.getScope(node)
  while (scope !== null) {
    const variable = scope.variables.find((candidate) => candidate.name === node.name)
    if (variable) {
      return variable.defs.some(
        (def) =>
          def.type === 'ImportBinding' &&
          isHelperSource(def.parent?.source?.value) &&
          // The imported name, not the local one: an alias may call it anything, and a
          // different export from the same module is a different function.
          def.node?.imported?.name === 'useApiRequest'
      )
    }
    scope = scope.upper
  }

  return false
}

const firstTypeArgument = (node) => {
  const args = node.typeArguments ?? node.typeParameters
  return args?.params?.[0]
}

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

    'prefer-api-command': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'A request that reads nothing back is `useApiCommand`. `useApiRequest` is for an endpoint ' +
            'that always answers with a body, and refuses a response without one.',
        },
        schema: [],
      },
      create(context) {
        const reportedMethods = new Set(['DELETE', 'delete'])

        // `any` and `never` satisfy the response constraint without meaning anything, and a call
        // with no type argument at all infers it -- so the type cannot speak for these three.
        const unhelpfulTypeArgument = (node) => {
          const first = firstTypeArgument(node)
          if (!first) return true

          return first.type === 'TSAnyKeyword' || first.type === 'TSNeverKeyword'
        }

        const methodLiteral = (node) => {
          const arg = node.arguments[0]
          if (!arg || arg.type !== 'ObjectExpression') return null
          const property = arg.properties.find(
            (candidate) =>
              candidate.type === 'Property' &&
              !candidate.computed &&
              (candidate.key.name ?? candidate.key.value) === 'method'
          )
          if (!property || property.value.type !== 'Literal') return null

          return property.value.value
        }

        return {
          CallExpression(node) {
            if (node.callee.type !== 'Identifier' || !isHelperBinding(context, node.callee)) return

            const method = methodLiteral(node)
            const isDelete = typeof method === 'string' && reportedMethods.has(method)
            if (!isDelete && !unhelpfulTypeArgument(node)) return

            context.report({
              node,
              message: isDelete
                ? 'A delete usually reads nothing back: use `useApiCommand`. If this endpoint really answers ' +
                  'with the deleted entity, disable this line and say so.'
                : 'State what this answers with. `useApiRequest<Entity>` for a body, `useApiCommand` for none, ' +
                  '`optionalBody: true` for either.',
            })
          },
        }
      },
    },

    'prefer-api-fetch-items': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'A request whose answer is a list -- a bare array or a list envelope -- is ' +
            '`useApiFetchItems`; `useApiRequest` checks nothing about the body it hands back.',
        },
        schema: [],
      },
      create(context) {
        const isArrayType = (node) => {
          if (!node) return false
          if (node.type === 'TSArrayType') return true

          return (
            node.type === 'TSTypeReference' &&
            node.typeName?.type === 'Identifier' &&
            (node.typeName.name === 'Array' || node.typeName.name === 'ReadonlyArray') &&
            (node.typeArguments ?? node.typeParameters)?.params?.length === 1
          )
        }

        const envelopeGeneric = (node) => {
          if (node.type !== 'TSTypeReference' || node.typeName?.type !== 'Identifier') return false
          if (node.typeName.name !== 'ApiResponseList' && node.typeName.name !== 'ApiInfiniteResponseList') {
            return false
          }
          const params = (node.typeArguments ?? node.typeParameters)?.params

          // `ApiResponseList<T>` is `{ totalCount; data: T }`, so only an array in that slot makes
          // `data` a list. `ApiResponseList<Item>` is something this helper would refuse.
          return params?.length === 1 && isArrayType(params[0])
        }

        const envelopeLiteral = (node) => {
          if (node.type !== 'TSTypeLiteral') return false

          // Exactly one member, on purpose: a literal that also spells out `hasNextPage` or
          // `totalCount` is an author saying they read the metadata, which is a reason to stay on
          // `useApiRequest`. The generic form carries no such signal, so it is reported and the one
          // legitimate reader takes a disable with a reason.
          if (node.members.length !== 1) return false
          const member = node.members[0]

          return (
            member.type === 'TSPropertySignature' &&
            member.computed === false &&
            (member.key?.name ?? member.key?.value) === 'data' &&
            isArrayType(member.typeAnnotation?.typeAnnotation)
          )
        }

        return {
          CallExpression(node) {
            if (node.callee.type !== 'Identifier' || !isHelperBinding(context, node.callee)) return

            // No type argument at all is `prefer-api-command`'s case, not this one.
            const first = firstTypeArgument(node)
            if (!first) return

            if (isArrayType(first)) {
              context.report({
                node,
                message:
                  "This answers with a bare array: use `useApiFetchItems` with `shape: 'array'`. If the " +
                  'endpoint really answers with something that only looks like a list, disable this line and say so.',
              })

              return
            }

            if (envelopeGeneric(first) || envelopeLiteral(first)) {
              context.report({
                node,
                message:
                  'This answers with a list envelope: use `useApiFetchItems`, or `useApiFetchList` when the ' +
                  "user drives the paging. If this call reads the envelope's metadata, disable this line and say so.",
              })
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
            'for useApiRequest / useApiCommand / useApiFetchList / useApiFetchByIds / ' +
            'useApiFetchItems / useApiFetchListBatch calls.',
        },
        schema: [],
      },
      create(context) {
        const TARGET_CALLEES = new Set([
          'useApiRequest',
          // The commands are where most of the fleet's `:id` templates are -- every delete is one.
          'useApiCommand',
          'useApiFetchList',
          'useApiFetchByIds',
          'useApiFetchItems',
          'useApiFetchListBatch',
        ])

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
            const keyName = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null
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

            // The path only, because that is all `stringUrlTemplateReplace` substitutes into: it
            // splits the template on `?` and rejoins the query untouched. Scanning the query too
            // would fail CI on a perfectly good `...?locale=:locale`, and adding `locale` to
            // `urlParams` to silence it would change nothing at runtime.
            const [path] = resolved.split('?')

            // Exactly what `stringUrlTemplateReplace` does, and nothing else: split the path on `/`,
            // skip any part that does not START with `:`, and take everything after that colon as the
            // key. Both halves matter and both were got wrong in turn. Hunting for `:name` anywhere
            // matches inside `prefix-:id`, which the runtime leaves alone, so the rule demanded a key
            // that is never filled in. Requiring the key to look like an identifier misses `:asset-id`,
            // which the runtime substitutes happily, so the rule reported the caller's correct
            // `urlParams` as having no placeholder to match.
            const placeholders = new Set()
            for (const segment of path.split('/')) {
              if (!segment.startsWith(':')) continue
              // No guard on the name, because the runtime has none: a bare `:` takes `''` as its key
              // and fills the segment in from `params['']`. Nobody writes that on purpose, which is
              // the point -- it is a typo, and the rule reporting a missing key is how it gets seen
              // rather than shipped as a literal colon in the url.
              placeholders.add(segment.slice(1))
            }

            const paramKeys = collectStaticKeys(paramsProp.value)
            if (paramKeys === null) return

            const paramKeySet = new Set(paramKeys)

            for (const placeholder of placeholders) {
              if (!paramKeySet.has(placeholder)) {
                context.report({
                  node: paramsProp,
                  message: `urlParams is missing key '${placeholder}' required by urlTemplate ` + `'${resolved}'.`,
                })
              }
            }

            for (const key of paramKeys) {
              if (!placeholders.has(key)) {
                context.report({
                  node: paramsProp,
                  message:
                    `urlParams key '${key}' has no matching ':${key}' placeholder in urlTemplate ` + `'${resolved}'.`,
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
 * @param {boolean|'error'|'warn'|'off'} [options.preferApiFetchItems='error']
 *   - Severity for prefer-api-fetch-items rule.
 * @returns {Object} ESLint flat config entry
 */
export function recommended(options = {}) {
  const {
    noTsExtension = 'error',
    noFatalErrorAxiosCheck = 'error',
    preferApiCommand = 'error',
    preferApiFetchItems = 'error',
    urlParamsMatchTemplate = 'error',
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

  // prefer-api-command
  const preferApiCommandSeverity = normalizeSeverity(preferApiCommand)
  if (preferApiCommandSeverity) {
    rules['anzu/prefer-api-command'] = preferApiCommandSeverity
  }

  // prefer-api-fetch-items
  const preferApiFetchItemsSeverity = normalizeSeverity(preferApiFetchItems)
  if (preferApiFetchItemsSeverity) {
    rules['anzu/prefer-api-fetch-items'] = preferApiFetchItemsSeverity
  }

  // url-params-match-template
  const urlParamsSeverity = normalizeSeverity(urlParamsMatchTemplate)
  if (urlParamsSeverity) {
    rules['anzu/url-params-match-template'] = urlParamsSeverity
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

export { anzuPlugin }
