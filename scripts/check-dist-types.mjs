// Type-checks the published declarations the way a consumer without `skipLibCheck` would, and fails on
// any error inside dist/. Errors in dependencies' own declarations (Vuetify, vueuse) are not ours and
// are only counted. The rolled-up declarations this replaced had 80 errors nobody saw, because every
// admin sets `skipLibCheck` -- and each one turned a slot prop into `any`.
// Usage: node scripts/check-dist-types.mjs [distDir]   (after `yarn build`)
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.resolve(root, process.argv[2] ?? 'dist')
const entries = ['common-admin.d.ts', 'testing.d.ts'].map((file) => path.join(dist, file))

const program = ts.createProgram(entries, {
  strict: true,
  skipLibCheck: false,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [],
})
const diagnostics = ts.getPreEmitDiagnostics(program)
const inDist = diagnostics.filter((d) => d.file && path.resolve(d.file.fileName).startsWith(dist + path.sep))

for (const d of inDist) {
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0)
  const where = `${path.relative(root, d.file.fileName)}:${line + 1}:${character + 1}`
  console.error(`${where} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
}
console.log(`${inDist.length} error(s) in ${path.relative(root, dist)}, ${diagnostics.length - inDist.length} in dependencies`)
process.exit(inDist.length > 0 ? 1 : 0)
