// Fails when the built stylesheet is not what the admins' cascade layer order expects: it has to open
// with the layer order statement and keep every rule inside `anzu-common` (or Vuetify's reset layer).
// Tests and the playground load the library's CSS unlayered, so nothing else would notice.
// Usage: node scripts/check-dist-css.mjs [distDir]   (after `yarn build`)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const file = path.join(path.resolve(root, process.argv[2] ?? 'dist'), 'common-admin.css')
const ORDER = ['vuetify-core', 'vuetify-components', 'vuetify-overrides', 'anzu-common', 'vuetify-utilities', 'vuetify-final']
const SUBLAYERS = [
  'vuetify-core.reset, vuetify-core.base',
  'vuetify-utilities.theme-base, vuetify-utilities.typography, vuetify-utilities.helpers, vuetify-utilities.theme-background, vuetify-utilities.theme-foreground',
  'vuetify-final.transitions, vuetify-final.trumps',
]
const BLOCKS = new Set(['anzu-common', 'vuetify-core.reset'])

const nodes = postcss.parse(fs.readFileSync(file, 'utf8')).nodes.filter((node) => node.type !== 'comment')
const problems = []
const first = nodes[0]
const order = first?.type === 'atrule' && first.name === 'layer' && !first.nodes ? first.params.split(',').map((layer) => layer.trim()) : []
if (order.join() !== ORDER.join()) problems.push(`does not open with @layer ${ORDER.join(', ')};`)
const subs = nodes.slice(1, 1 + SUBLAYERS.length).map((node) => (node.type === 'atrule' && node.name === 'layer' && !node.nodes ? node.params : ''))
if (subs.join('|') !== SUBLAYERS.join('|')) problems.push(`does not follow it with Vuetify's sub-layer order (${SUBLAYERS.map((s) => `@layer ${s};`).join(' ')})`)
for (const node of nodes.slice(1)) {
  const isLayer = node.type === 'atrule' && node.name === 'layer'
  if (isLayer && !node.nodes) continue
  if (isLayer && BLOCKS.has(node.params)) continue
  problems.push(`outside the library's layers: ${node.toString().slice(0, 80)}`)
}
if (!nodes.some((node) => node.type === 'atrule' && node.name === 'layer' && node.params === 'anzu-common' && node.nodes)) {
  problems.push('has no @layer anzu-common block')
}
for (const problem of problems) console.error(`${path.relative(root, file)} ${problem}`)
if (problems.length > 0) process.exit(1)
console.log('dist CSS: layer order and sub-layer statements first, every rule inside anzu-common or vuetify-core.reset')
