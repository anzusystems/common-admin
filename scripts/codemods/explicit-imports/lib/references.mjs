/**
 * Which auto-imported names a piece of code uses without binding them itself.
 *
 * Every unit is its own module in one program without lib, without module resolution and without
 * the generated `auto-imports.d.ts`, so the checker can only bind a name to a declaration in the
 * same unit: an import, a local, a parameter, … — what unimport would otherwise have supplied. The
 * value and the type meaning are resolved separately (`interface ref {}` does not bind `ref()`,
 * a type parameter does not shadow a value, class and enum bind both).
 */

// Positions where an identifier is a name, not a reference.
function referenceKind(ts, node) {
  const parent = node.parent
  const K = ts.SyntaxKind
  switch (parent.kind) {
    case K.PropertyAccessExpression:
      return parent.name === node ? null : 'value'
    case K.QualifiedName: {
      if (parent.right === node) return null
      let top = parent
      while (top.parent.kind === K.QualifiedName) top = top.parent
      if (top.parent.kind === K.ImportType && top.parent.qualifier === top) return null
      return top.parent.kind === K.TypeQuery ? 'typeof' : 'namespace'
    }
    case K.ImportType:
      return parent.qualifier === node ? null : 'value'
    case K.PropertyAssignment:
      return parent.name === node ? null : 'value'
    case K.ShorthandPropertyAssignment:
      return 'value'
    case K.ExportSpecifier: {
      if (parent.parent.parent.moduleSpecifier) return null
      return (parent.propertyName ?? parent.name) === node ? 'export' : null
    }
    case K.TypeReference:
      return parent.typeName === node ? 'type' : null
    case K.TypeQuery:
      return parent.exprName === node ? 'typeof' : null
    case K.ExpressionWithTypeArguments: {
      if (parent.expression !== node) return 'value'
      const heritage = parent.parent
      const implementsOrInterface =
        heritage.token === K.ImplementsKeyword || heritage.parent.kind === K.InterfaceDeclaration
      return implementsOrInterface ? 'type' : 'value'
    }
    case K.TypePredicate:
      return parent.parameterName === node ? null : 'type'
    case K.LabeledStatement:
    case K.BreakStatement:
    case K.ContinueStatement:
      return null
    case K.BindingElement:
      if (parent.propertyName === node || parent.name === node) return null
      return 'value'
    case K.MetaProperty:
    case K.ImportSpecifier:
    case K.ImportClause:
    case K.NamespaceImport:
    case K.NamespaceExport:
    case K.ImportEqualsDeclaration:
    case K.NamedTupleMember:
      return null
    case K.VariableDeclaration:
    case K.FunctionDeclaration:
    case K.FunctionExpression:
    case K.ClassDeclaration:
    case K.ClassExpression:
    case K.InterfaceDeclaration:
    case K.TypeAliasDeclaration:
    case K.EnumDeclaration:
    case K.EnumMember:
    case K.ModuleDeclaration:
    case K.Parameter:
    case K.TypeParameter:
    case K.PropertyDeclaration:
    case K.PropertySignature:
    case K.MethodDeclaration:
    case K.MethodSignature:
    case K.GetAccessor:
    case K.SetAccessor:
      return parent.name === node ? null : 'value'
    default:
      return 'value'
  }
}

/**
 * `templateTypes` of a unit are type names a compiled template uses (`as IntegerId`, typed slot
 * props); they count as unbound when the unit does not bind them at its top level.
 *
 * @param units {{ id: string, code: string, js?: boolean, templateTypes?: Iterable<string> }[]}
 * @returns {Map<string, { value: Set<string>, type: Set<string>, problems: string[] }>}
 */
export function findUnboundReferences(ts, units, names) {
  const files = new Map(units.map((u) => [u.id, u]))
  const sources = new Map()
  const options = {
    noLib: true,
    noResolve: true,
    types: [],
    allowJs: true,
    checkJs: false,
    moduleDetection: ts.ModuleDetectionKind.Force,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  const host = {
    getSourceFile(fileName) {
      const unit = files.get(fileName)
      if (!unit) return undefined
      if (!sources.has(fileName)) {
        const kind = unit.js ? ts.ScriptKind.JS : ts.ScriptKind.TS
        sources.set(fileName, ts.createSourceFile(fileName, unit.code, ts.ScriptTarget.ESNext, true, kind))
      }
      return sources.get(fileName)
    },
    getDefaultLibFileName: () => '/lib.d.ts',
    writeFile() {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (f) => files.has(f),
    readFile: (f) => files.get(f)?.code,
  }
  const program = ts.createProgram({ rootNames: [...files.keys()], options, host })
  const checker = program.getTypeChecker()
  const results = new Map()

  for (const unit of units) {
    const sourceFile = program.getSourceFile(unit.id)
    const value = new Set()
    const typeOnly = new Set()
    const problems = []
    const visit = (node) => {
      if (ts.isIdentifier(node) && names.all.has(node.text)) {
        const name = node.text
        const kind = referenceKind(ts, node)
        if (kind === 'value' || kind === 'export') {
          if (!checker.resolveName(name, node, ts.SymbolFlags.Value, false)) {
            if (names.values.has(name)) value.add(name)
            else if (kind === 'export') typeOnly.add(name)
            else problems.push(`type-only auto-import ${name} used as a value`)
          }
        } else if (kind === 'typeof') {
          if (!checker.resolveName(name, node, ts.SymbolFlags.Value, false) && names.values.has(name)) {
            typeOnly.add(name)
          }
        } else if (kind === 'type' || kind === 'namespace') {
          const meaning = kind === 'type' ? ts.SymbolFlags.Type : ts.SymbolFlags.Namespace
          if (!checker.resolveName(name, node, meaning, false)) typeOnly.add(name)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    for (const name of unit.templateTypes ?? []) {
      if (!checker.resolveName(name, sourceFile, ts.SymbolFlags.Type, false)) typeOnly.add(name)
    }
    for (const name of value) typeOnly.delete(name)
    results.set(unit.id, { value, type: typeOnly, problems })
  }
  return results
}
