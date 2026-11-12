// Fails when the build imports a package that package.json does not declare. An undeclared import
// works only while the consumer happens to have it hoisted (`@vueuse/shared` in the declarations did),
// or not at all (`socket.io-client` for an admin without collaboration).
// Usage: node scripts/check-dist-imports.mjs [distDir]   (after `yarn build`)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.resolve(root, process.argv[2] ?? 'dist')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const declared = new Set([...Object.keys(pkg.peerDependencies ?? {}), ...Object.keys(pkg.dependencies ?? {})])

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })

const packageOf = (specifier) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')

const missing = new Map()
for (const file of walk(dist).filter((f) => /\.(m?js|d\.ts)$/.test(f))) {
  const { importedFiles } = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true)
  for (const { fileName } of importedFiles) {
    if (fileName.startsWith('.') || fileName.startsWith('/') || fileName.startsWith('node:')) continue
    const name = packageOf(fileName)
    if (declared.has(name) || name === pkg.name) continue
    if (!missing.has(name)) missing.set(name, path.relative(root, file))
  }
}

if (missing.size > 0) {
  for (const [name, file] of missing) console.error(`${name} is imported by ${file} but is not a (peer) dependency`)
  process.exit(1)
}
console.log(`dist imports only declared packages (${declared.size} declared)`)
