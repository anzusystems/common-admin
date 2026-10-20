import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { DAM_DEFAULT_STORE, DAM_NAME_ACCESSORS, DAM_NAME_STORE_METHODS } from '@/test/support/damConfigNameAccessors'

// Every state of a DAM is kept per DAM configuration name, and a call that names none, or names it with what may be
// `undefined`, goes to `default` in silence (a public accessor with an optional name), or to every DAM (a settle
// function of the upload store). In the DAM domain, outside the tests, every call of such an accessor names its
// configuration with what is a name for sure. The TypeScript compiler API reads the sources (in node: it does not run
// in the browser of the rest of the suite), and the name argument of each call is accepted only as:
// - a string literal;
// - what `useDamConfigName(…)` or `inheritedDamConfigName(…)` answers, also through a variable;
// - a parameter or a variable typed `string` (or `UploadQueueRowsOf`, of the settle functions), not optional, or with
//   a string default; a variable that holds an accepted value;
// - a prop of the component declared without `?` (`props.configName`);
// - `x ?? <accepted>`, a conditional of two accepted values, a call of a function of the file that answers one,
//   `{ queueKey }` (of the settle functions).
// `undefined`, an optional prop or parameter, and anything else are not names. A call in a template is not allowed at
// all, and neither is `useDamConfigStore()` outside `useDamConfigStoreOf`. An accessor imported under another name, or
// called by a bracket (`store['refreshAsset'](…)`), is read as itself.
// What it does not prove: that the name is the right one. A literal or a `string` fixed to `'default'` in a component
// under `own` passes, and a prop declared without `?` may still be `undefined` at runtime, where a parent leaves it
// out. It proves that a name is passed, by what the types say.

/** Where the guard reads; `DAM_GUARD_ROOT` points it at another tree (a check of the guard itself). */
const ROOT = process.env.DAM_GUARD_ROOT ?? fileURLToPath(new URL('../../domains/dam', import.meta.url))

/** Functions that answer a configuration name, wherever they are declared. */
const NAME_PRODUCERS = new Set(['useDamConfigName', 'inheritedDamConfigName'])
/** Types that are a name for sure. */
const NAME_TYPES = new Set(['UploadQueueRowsOf'])

/** The one nameless call allowed, and why: the store hears a change of any socket, whatever the name. */
const SOCKET_CHANGE = {
  file: 'uploadQueue/store/uploadQueuesStore.ts',
  call: 'useDamNotificationsConnection().onChange',
}

/** Names whose type the parser does not see, each a name for sure, and why. */
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

/** The scripts of a file, each with the line it starts at; of a `.vue` file its `<script>` blocks. */
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

/** What a method is called on: `store` of `store.x(…)` and of `store['x'](…)`. */
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

/** The declaration of `name` seen from `from`: a parameter, a variable or a function of an enclosing scope. */
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

/** Whether a function answers a name: typed `string`, or an arrow whose body is an accepted value. */
const answersName = (fn: ts.Node, props: Map<string, boolean>, depth: number): boolean => {
  if (!ts.isFunctionLike(fn)) return false
  if (fn.type) return isNameType(fn.type)
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return isName(fn.body, props, depth + 1)
  return false
}

/** Whether the expression is a configuration name for sure. */
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
    // A method of a parameter typed in place: `store.configOf(queueKey)` of `store: { configOf(…): string }`.
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

/** The props of a component (`defineProps<{ … }>()`): whether each is declared without `?`. */
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

/** Destructured accessors under another name: `const { savingOf: wait } = store`. */
const aliasesOf = (file: ts.SourceFile) => {
  const aliases = new Map<string, string>()
  const visit = (node: ts.Node) => {
    // `const { savingOf: wait } = store`, `import { useDamCachedUsers as usersOf } from '…'`.
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

/** The arguments of a call, an array spread into it taken apart. */
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
