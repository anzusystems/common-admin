import fs from 'node:fs'
import path from 'node:path'

// Route names checked against the admin's generated `src/typed-router.d.ts`: a literal `name`, `route`
// or `*RouteName` value that starts with `/` has to be one of its routes. The admins had this rule
// each in its own copy; the path comes from `settings.anzu.typedRouter` (set by
// `defineAnzuAdminConfig`, absolute) and falls back to the one under the cwd.

const loaded = new Map()
// The declaration is generated and gitignored, so a fresh clone has none until `generate:dts` ran.
// Staying quiet then would make the rule a no-op exactly when nobody expects it, so the first file of
// the run says so instead. Once per run and file, not once per linted file.
const reportedMissing = new Set()

function loadRoutes(file) {
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return loaded.get(file)?.routes ?? new Set()
  }
  const cached = loaded.get(file)
  if (cached && stat.mtimeMs === cached.mtimeMs) return cached.routes

  const content = fs.readFileSync(file, 'utf8')
  const routes = new Set()
  const re = /'([^']+)':\s*RouteRecordInfo/g
  let m
  while ((m = re.exec(content)) !== null) {
    routes.add(m[1])
  }
  loaded.set(file, { routes, mtimeMs: stat.mtimeMs })
  return routes
}

function isRouteKey(key) {
  if (!key) return false
  const normalized = String(key).replace(/-/g, '').toLowerCase()
  return normalized === 'name' || normalized === 'route' || normalized.endsWith('routename')
}

export const validRouteName = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate route names against generated src/typed-router.d.ts',
    },
    schema: [],
    messages: {
      unknown:
        "Unknown route name '{{name}}'. Not found in {{file}}. " + 'Run `yarn generate:dts` if routes were just added.',
      missing: '{{file}} is missing or empty, so route names cannot be validated. Run `yarn generate:dts`.',
    },
  },
  create(context) {
    const file = context.settings?.anzu?.typedRouter ?? path.join(context.cwd ?? process.cwd(), 'src/typed-router.d.ts')
    const routes = loadRoutes(file)
    const shown = path.relative(context.cwd ?? process.cwd(), file) || file
    if (routes.size === 0) {
      if (reportedMissing.has(file)) return {}
      reportedMissing.add(file)
      return {
        Program(node) {
          context.report({ node, messageId: 'missing', data: { file: shown } })
        },
      }
    }

    function checkLiteral(node, value) {
      if (typeof value !== 'string') return
      if (!value.startsWith('/')) return
      if (routes.has(value)) return
      context.report({ node, messageId: 'unknown', data: { name: value, file: shown } })
    }

    function checkProperty(prop) {
      if (!prop || prop.type !== 'Property') return
      const key = prop.key
      const keyName = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? String(key.value) : null
      if (!isRouteKey(keyName)) return
      const val = prop.value
      if (val && val.type === 'Literal') {
        checkLiteral(val, val.value)
      }
    }

    function checkAttributeLiteral(node) {
      const key = node.key
      if (!key) return
      let name
      if (key.type === 'VIdentifier') {
        name = key.name
      } else if (key.type === 'VDirectiveKey') {
        if (key.name?.name !== 'bind') return
        const arg = key.argument
        if (!arg || arg.type !== 'VIdentifier') return
        name = arg.name
      }
      if (!isRouteKey(name)) return
      const val = node.value
      if (!val) return
      if (val.type === 'VLiteral') {
        checkLiteral(val, val.value)
        return
      }
      if (val.type === 'VExpressionContainer' && val.expression?.type === 'Literal') {
        checkLiteral(val.expression, val.expression.value)
      }
    }

    const scriptVisitor = {
      Property: checkProperty,
    }

    const templateVisitor = {
      VAttribute: checkAttributeLiteral,
      'VElement > VStartTag > VAttribute > VExpressionContainer Property': checkProperty,
    }

    const parserServices = context.sourceCode?.parserServices ?? context.parserServices
    if (parserServices?.defineTemplateBodyVisitor) {
      return parserServices.defineTemplateBodyVisitor(templateVisitor, scriptVisitor)
    }
    return scriptVisitor
  },
}
