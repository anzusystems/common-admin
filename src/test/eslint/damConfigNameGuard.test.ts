import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { DAM_DEFAULT_STORE, DAM_NAME_ACCESSORS, DAM_NAME_STORE_METHODS } from '@/test/support/damConfigNameAccessors'

// Every DAM state is kept per DAM configuration name. A call with no name, or a possibly `undefined` one,
// silently uses `default` (public accessors) or hits every DAM (settle functions of the upload store).
// This guard reads the DAM domain sources outside tests with the TypeScript compiler API, in
// node. Each accessor call must pass a name that is surely a string: a literal, a
// `useDamConfigName(…)` or `inheritedDamConfigName(…)` result, a non-optional `string` parameter
// or variable, a prop declared without `?`, or `??`, a conditional or a local function of those.
// Calls in templates and `useDamConfigStore()` outside `useDamConfigStoreOf` are not allowed.
// It does not prove the name is the right one, only that a name is passed, as far as the types say.

/** Where the guard reads; `DAM_GUARD_ROOT` points it at another tree (a check of the guard itself). */
const ROOT = process.env.DAM_GUARD_ROOT ?? fileURLToPath(new URL('../../domains/dam', import.meta.url))

const NAME_PRODUCERS = new Set(['useDamConfigName', 'inheritedDamConfigName'])
const NAME_TYPES = new Set(['UploadQueueRowsOf'])

/** The one nameless call allowed, and why: the store hears a change of any socket, whatever the name. */
const SOCKET_CHANGE = {
  file: 'uploadQueue/store/uploadQueuesStore.ts',
  call: 'useDamNotificationsConnection().onChange',
}

const SEEN_TYPED: Array<{ file: string; call: string; argument: string; reason: string }> = [
  {
    file: 'uploadQueue/composables/uploadService.ts',
    call: 'useDamUploadChunkSize',
    argument: 'configName',
    reason: 'taken from the members of the upload preset, whose `configName` is typed `string` (`UploadPresetMembers`)',
  },
]

const ACCESSORS = new Map<string, number>([
  ...Object.entries(DAM_NAME_ACCESSORS),
  ...Object.entries(DAM_NAME_STORE_METHODS),
])

interface Finding {
  file: string
  line: number
  call: string
  why: string
}

const sourcesOf = (root: string): Record<string, string> => {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        if (entry !== '__tests__') walk(path)
        continue
      }
      if (!/\.(ts|vue)$/.test(entry) || entry.endsWith('.d.ts')) continue
      files[relative(root, path)] = readFileSync(path, 'utf8')
    }
  }
  walk(root)
  return files
}

const scriptsOf = (file: string, text: string) => {
  if (!file.endsWith('.vue')) return [{ code: text, line: 0 }]
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => ({
    code: match[1]!,
    line: text.slice(0, match.index! + match[0].indexOf('>') + 1).split('\n').length - 1,
  }))
}

const templateOf = (text: string) => {
  const start = text.indexOf('<template')
  const end = text.lastIndexOf('</template>')
  return start === -1 || end === -1
    ? null
    : { code: text.slice(start, end), line: text.slice(0, start).split('\n').length }
}

const calleeName = (call: ts.CallExpression) => {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  if (ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)) {
    return callee.argumentExpression.text
  }
  return null
}

const receiverOf = (call: ts.CallExpression) =>
  ts.isPropertyAccessExpression(call.expression) || ts.isElementAccessExpression(call.expression)
    ? call.expression.expression.getText()
    : null

const unwrap = (expr: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)
    ? unwrap(expr.expression)
    : expr

const isNameType = (type: ts.TypeNode) =>
  type.kind === ts.SyntaxKind.StringKeyword ||
  (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && NAME_TYPES.has(type.typeName.text))

const declarationOf = (name: string, from: ts.Node): ts.Node | null => {
  for (let node: ts.Node | undefined = from; node; node = node.parent) {
    if (ts.isFunctionLike(node)) {
      const parameter = node.parameters.find((one) => ts.isIdentifier(one.name) && one.name.text === name)
      if (parameter) return parameter
    }
    const statements = ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) ? node.statements : null
    for (const statement of statements ?? []) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return declaration
      }
    }
  }
  return null
}

const answersName = (fn: ts.Node, props: Map<string, boolean>, depth: number): boolean => {
  if (!ts.isFunctionLike(fn)) return false
  if (fn.type) return isNameType(fn.type)
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return isName(fn.body, props, depth + 1)
  return false
}

const isName = (raw: ts.Expression, props: Map<string, boolean>, depth = 0): boolean => {
  if (depth > 6) return false
  const expr = unwrap(raw)
  if (ts.isStringLiteralLike(expr)) return true
  if (ts.isIdentifier(expr)) {
    if (expr.text === 'undefined') return false
    const declaration = declarationOf(expr.text, expr)
    if (!declaration) return false
    if (ts.isParameter(declaration)) {
      if (declaration.questionToken || declaration.dotDotDotToken) return false
      if (declaration.type) return isNameType(declaration.type)
      return !!declaration.initializer && isName(declaration.initializer, props, depth + 1)
    }
    if (ts.isVariableDeclaration(declaration)) {
      if (declaration.type) return isNameType(declaration.type)
      if (!declaration.initializer) return false
      if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) return false
      return isName(declaration.initializer, props, depth + 1)
    }
    return false
  }
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'props') {
    return props.get(expr.name.text) === true
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return isName(expr.right, props, depth + 1)
  }
  if (ts.isConditionalExpression(expr)) {
    return isName(expr.whenTrue, props, depth + 1) && isName(expr.whenFalse, props, depth + 1)
  }
  if (ts.isCallExpression(expr) && !expr.questionDotToken) {
    const name = calleeName(expr)
    if (!name) return false
    if (NAME_PRODUCERS.has(name)) return true
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const receiver = expr.expression.expression
      const owner = ts.isIdentifier(receiver) ? declarationOf(receiver.text, expr) : null
      const type = owner && ts.isParameter(owner) ? owner.type : undefined
      const member =
        type && ts.isTypeLiteralNode(type) ? type.members.find((one) => one.name?.getText() === name) : undefined
      return (
        !!member && ts.isMethodSignature(member) && !member.questionToken && !!member.type && isNameType(member.type)
      )
    }
    if (!ts.isIdentifier(expr.expression)) return false
    const declaration = declarationOf(name, expr)
    if (!declaration) return false
    if (ts.isFunctionDeclaration(declaration)) return answersName(declaration, props, depth)
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return answersName(declaration.initializer, props, depth)
    }
    return false
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return expr.properties.some((property) => property.name?.getText() === 'queueKey')
  }
  return false
}

const propsOf = (file: ts.SourceFile) => {
  const props = new Map<string, boolean>()
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && calleeName(node) === 'defineProps') {
      const type = node.typeArguments?.[0]
      if (type && ts.isTypeLiteralNode(type)) {
        for (const member of type.members) {
          if (ts.isPropertySignature(member) && member.name) {
            props.set(member.name.getText(), !member.questionToken && !!member.type && isNameType(member.type))
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return props
}

const aliasesOf = (file: ts.SourceFile) => {
  const aliases = new Map<string, string>()
  const visit = (node: ts.Node) => {
    if ((ts.isBindingElement(node) || ts.isImportSpecifier(node)) && node.propertyName && ts.isIdentifier(node.name)) {
      const accessor = node.propertyName.getText()
      if (ACCESSORS.has(accessor) || accessor === DAM_DEFAULT_STORE) aliases.set(node.name.text, accessor)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return aliases
}

const enclosingFunctionName = (node: ts.Node) => {
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name) return at.name.text
    if (ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) return at.name.text
  }
  return null
}

const argumentsOf = (call: ts.CallExpression) =>
  call.arguments.flatMap((argument) =>
    ts.isSpreadElement(argument) && ts.isArrayLiteralExpression(argument.expression)
      ? [...argument.expression.elements]
      : [argument]
  )

const findingsOf = (file: string, text: string): Finding[] => {
  const found: Finding[] = []
  for (const script of scriptsOf(file, text)) {
    const source = ts.createSourceFile(file, script.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const props = propsOf(source)
    const aliases = aliasesOf(source)
    const report = (node: ts.Node, call: string, why: string) =>
      found.push({
        file,
        line: script.line + source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        call,
        why,
      })
    const visit = (node: ts.Node) => {
      ts.forEachChild(node, visit)
      if (!ts.isCallExpression(node)) return
      const written = calleeName(node)
      if (!written) return
      const name = ts.isIdentifier(node.expression) ? (aliases.get(written) ?? written) : written
      // The settlement's own refresh takes a target, not the store's name.
      if (name === 'refreshAsset' && receiverOf(node)?.endsWith('settlement')) return
      if (name === DAM_DEFAULT_STORE) {
        if (enclosingFunctionName(node) !== 'useDamConfigStoreOf') report(node, name, 'the store of `default`')
        return
      }
      const position = ACCESSORS.get(name)
      if (!position) return
      const parent = node.parent
      if (
        name === 'useDamNotificationsConnection' &&
        file === SOCKET_CHANGE.file &&
        node.arguments.length === 0 &&
        ts.isPropertyAccessExpression(parent) &&
        `${name}().${parent.name.text}` === SOCKET_CHANGE.call
      ) {
        return
      }
      const given = argumentsOf(node)
      const argument = given[position - 1]
      if (given.slice(0, position).some((one) => ts.isSpreadElement(one))) {
        report(node, name, 'a name spread from what is not seen')
      } else if (!argument) report(node, name, 'no name')
      else if (
        !isName(argument, props) &&
        !SEEN_TYPED.some((seen) => seen.file === file && seen.call === name && seen.argument === argument.getText())
      ) {
        report(node, name, `not a name for sure: ${argument.getText()}`)
      }
    }
    visit(source)
  }
  const template = file.endsWith('.vue') ? templateOf(text) : null
  for (const name of template ? [...ACCESSORS.keys(), DAM_DEFAULT_STORE] : []) {
    for (const match of template!.code.matchAll(new RegExp(`(^|[^\\w$.])${name}\\s*\\(`, 'g'))) {
      const line = template!.line + template!.code.slice(0, match.index).split('\n').length - 1
      found.push({ file, line, call: name, why: 'called in a template' })
    }
  }
  return found
}

const findingsIn = (files: Record<string, string>) =>
  Object.entries(files)
    .flatMap(([file, text]) => findingsOf(file, text))
    .map(({ file, line, call, why }) => `${file}:${line} ${call}: ${why}`)

describe('the DAM configuration name', () => {
  it('is given, for sure, to every accessor of a state of a DAM in the DAM domain', () => {
    const files = sourcesOf(ROOT)
    expect(Object.keys(files).length).toBeGreaterThan(100)

    expect(findingsIn(files)).toEqual([])
  })

  it.each(SEEN_TYPED)('is typed where the parser does not see it: $reason', ({ file, call, argument }) => {
    expect(sourcesOf(ROOT)[file]).toContain(`${call}(apiTimeout ?? undefined, ${argument})`)
  })

  it('is the one name the socket change of the upload store reads without', () => {
    const store = sourcesOf(ROOT)[SOCKET_CHANGE.file]!

    expect(store.match(/useDamNotificationsConnection\(\)/g)).toEqual(['useDamNotificationsConnection()'])
    expect(store).toContain(SOCKET_CHANGE.call)
  })

  describe('as the guard reads it', () => {
    const findings = (code: string, file = 'planted.ts') =>
      findingsIn({ [file]: code }).map((one) => one.split(' ').slice(1).join(' '))

    it.each([
      ["useDamCachedUsers('own')", []],
      ['useDamCachedUsers()', ['useDamCachedUsers: no name']],
      ['useDamCachedUsers(undefined)', ['useDamCachedUsers: not a name for sure: undefined']],
      ['useDamCachedUsers(\n  \n)', ['useDamCachedUsers: no name']],
      ['useDamConfigStoreOf()', ['useDamConfigStoreOf: no name']],
      ['useDamConfigState(client)', ['useDamConfigState: no name']],
      ["useDamConfigState(...[client, 'own'])", []],
      ['useDamConfigState(...args)', ['useDamConfigState: a name spread from what is not seen']],
      ["withinWaitLimit<number>(wait, 1, 'own')", []],
      ['withinWaitLimit<number>(wait, 1)', ['withinWaitLimit: no name']],
      ['store.addByFiles?.(queue, ext, licence, files)', ['addByFiles: no name']],
      ["store.savingOf(id, 'own')", []],
      ['store.savingOf(id)', ['savingOf: no name']],
      ["const { savingOf: wait } = store\nwait(id, 'own')", []],
      ['const { savingOf: wait } = store\nwait(id)', ['savingOf: no name']],
      ["store.refreshAsset(id, { queueKey: 'q' })", []],
      ['store.refreshAsset(id)', ['refreshAsset: no name']],
      ['settlement.refreshAsset(target)', []],
      ["settlement['refreshAsset'](target)", []],
      ["store['refreshAsset'](id)", ['refreshAsset: no name']],
      ["store['refreshAsset'](id, 'own')", []],
      ["import { useDamCachedUsers as usersOf } from 'cached'\nusersOf()", ['useDamCachedUsers: no name']],
      ["import { useDamCachedUsers as usersOf } from 'cached'\nusersOf('own')", []],
      [
        "import { useDamConfigStore as storeOfDefault } from 'store'\nstoreOfDefault()",
        ['useDamConfigStore: the store of `default`'],
      ],
      ["store.queueItemDuplicate(id, file, type, 'own')", []],
      ['store.queueItemFailed(id, reason)', ['queueItemFailed: no name']],
      ['// useDamCachedAuthors() in a comment', []],
      ['export function useDamCachedUsers(configName?: string) {}', []],
      ['const name = useDamConfigName(props.configName)\nuseDamCachedAuthors(name)', []],
      ['useDamCachedAuthors(useDamConfigName())', []],
      ['useDamCachedAuthors(inheritedDamConfigName(configName))', []],
      ['const name = maybe()\nuseDamCachedAuthors(name)', ['useDamCachedAuthors: not a name for sure: name']],
      ['function f(configName: string) {\n  useDamCachedAuthors(configName)\n}', []],
      [
        'function f(configName?: string) {\n  useDamCachedAuthors(configName)\n}',
        ['useDamCachedAuthors: not a name for sure: configName'],
      ],
      [
        'function f(configName: string | undefined) {\n  useDamCachedAuthors(configName)\n}',
        ['useDamCachedAuthors: not a name for sure: configName'],
      ],
      ["function f(configName = 'default') {\n  useDamCachedAuthors(configName)\n}", []],
      [
        "const f = (queueKey?: string) => useDamCachedAuthors(configOf(queueKey))\nconst configOf = (queueKey?: string) => names.get(queueKey) ?? 'default'",
        [],
      ],
      [
        'const f = (queueKey?: string) => useDamCachedAuthors(names.get(queueKey))',
        ['useDamCachedAuthors: not a name for sure: names.get(queueKey)'],
      ],
      [
        'function f(store: { configOf(queueKey: string): string }) {\n  libraryUploadPreset(store.configOf(key))\n}',
        [],
      ],
      [
        'function f(store: { configOf?(queueKey: string): string }) {\n  libraryUploadPreset(store.configOf?.(key))\n}',
        ['libraryUploadPreset: not a name for sure: store.configOf?.(key)'],
      ],
      ["useDamCachedAuthors(maybe ?? 'default')", []],
      [
        'useDamCachedAuthors(useDamConfigName ? props.configName : undefined)',
        ['useDamCachedAuthors: not a name for sure: useDamConfigName ? props.configName : undefined'],
      ],
      ['useDamConfigStore()', ['useDamConfigStore: the store of `default`']],
      ['useDamConfigStore(pinia)', ['useDamConfigStore: the store of `default`']],
      [
        "export function useDamConfigStoreOf(configName = 'default', pinia) {\n  if (configName === 'default') return useDamConfigStore(pinia)\n}",
        [],
      ],
      ['useDamNotificationsConnection().onChange(update)', ['useDamNotificationsConnection: no name']],
    ] as Array<[string, string[]]>)('in %s', (code, expected) => {
      expect(findings(code)).toEqual(expected)
    })

    it('reads the props of a component: an optional one is no name, one declared without `?` is', () => {
      const component = (declaration: string) =>
        `<script setup lang="ts">\nconst props = defineProps<{ ${declaration} }>()\nconst store = useDamConfigStoreOf(props.configName)\n</script>`

      expect(findings(component('configName?: string'), 'Planted.vue')).toEqual([
        'useDamConfigStoreOf: not a name for sure: props.configName',
      ])
      expect(findings(component('configName: string'), 'Planted.vue')).toEqual([])
    })

    it('allows no call of an accessor in a template', () => {
      const component =
        '<script setup lang="ts">\nconst name = \'own\'\n</script>\n<template>\n  <div>{{ useDamCachedUsers(name) }}</div>\n</template>'

      expect(findings(component, 'Planted.vue')).toEqual(['useDamCachedUsers: called in a template'])
    })
  })
})
