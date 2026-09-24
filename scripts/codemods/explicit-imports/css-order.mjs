#!/usr/bin/env node
/**
 * Compares the CSS of two builds of an admin, for a change that only reorders imports.
 *
 *   node scripts/codemods/explicit-imports/css-order.mjs /path/to/admin dist-before dist-after
 *
 * Scoped-style ids (`data-v-…`) hash the file content, so they differ; they are compared as one
 * placeholder. The stylesheets index.html links count as one sequence, the startup CSS, whichever
 * chunks hold them; every lazily loaded CSS file has to keep the same rules. Where two rules swapped places, the swap
 * is reported when it can decide the cascade: the same `@media`/`@layer` context, a property of
 * the same family (`margin` and `margin-top` count as one), an equal specificity and the same box (not
 * `::before` against `::after`, not `img` against `div`). Those are
 * listed for a review; the exit code is 1 when rules differ, 2 when swaps need a review.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'

const [adminArg, beforeArg, afterArg] = process.argv.slice(2)
const adminDir = resolve(adminArg)
const postcss = createRequire(join(adminDir, 'package.json'))('postcss')

const cssFiles = (dir) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.css'))
    .map((f) => join(dir, f))
// A scoped style carries its component's id in `data-v-…` and in the names of its keyframes.
function canonical(css) {
  const ids = new Set(Array.from(css.matchAll(/data-v-([0-9a-f]{8})/g), (m) => m[1]))
  let result = css.replace(/data-v-[0-9a-f]{8}/g, 'data-v-*')
  for (const id of ids) result = result.replaceAll(`-${id}`, '-*')
  return result
}

function rules(css) {
  const list = []
  postcss.parse(css).walkRules((rule) => {
    const context = []
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`)
    }
    const properties = []
    const declarations = []
    rule.walkDecls((decl) => {
      properties.push(decl.prop)
      declarations.push(decl.toString())
    })
    // One entry per selector: the minifier merges neighbouring rules with the same declarations,
    // and which ones are neighbours depends on the order that is being compared.
    for (const selector of rule.selectors) {
      list.push({ context: context.join(' / '), selector, properties, text: `${selector}{${declarations.join(';')}}` })
    }
  })
  return list
}

function specificity(selector) {
  const cleaned = selector
    .replace(/:(where)\([^)]*\)/g, '')
    .replace(/::?[\w-]+\(([^)]*)\)/g, (m, inner) => (m.startsWith(':not') || m.startsWith(':is') || m.startsWith(':has') ? ` ${inner}` : ' .x'))
  const ids = (cleaned.match(/#[\w-]+/g) ?? []).length
  const classes = (cleaned.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length
  const elements = (cleaned.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length + (cleaned.match(/::[\w-]+/g) ?? []).length
  return `${ids},${classes},${elements}`
}
const family = (prop) => (prop.startsWith('--') ? prop : prop.replace(/^-\w+-/, '').split('-')[0])

// The box a selector styles: its pseudo-element (or the element itself) and its tag, if any. Two
// selectors that style different boxes cannot compete, whatever their order.
function subject(selector) {
  const last = selector.trim().split(/\s*[\s>+~]\s*/).at(-1)
  const pseudo = last.match(/::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter)\b/)?.[1] ?? ''
  const tag = last.match(/^[a-zA-Z][\w-]*/)?.[0].toLowerCase() ?? ''
  return { pseudo, tag }
}
const sameBox = (a, b) => a.pseudo === b.pseudo && (!a.tag || !b.tag || a.tag === b.tag)

function swaps(before, after) {
  const key = (rule, i, seen) => {
    const id = `${rule.context}\u0000${rule.text}`
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    return `${id}\u0000${n}`
  }
  const seenA = new Map()
  const seenB = new Map()
  const keysA = before.map((r, i) => key(r, i, seenA))
  const positionB = new Map(after.map((r, i) => [key(r, i, seenB), i]))
  const findings = []
  const specs = before.map((r) => new Set(r.selector.split(',').map((s) => specificity(s.trim()))))
  const families = before.map((r) => new Set(r.properties.map(family)))
  const boxes = before.map((r) => subject(r.selector))
  for (let i = 0; i < before.length; i++) {
    for (let j = i + 1; j < before.length; j++) {
      if (positionB.get(keysA[i]) < positionB.get(keysA[j])) continue
      if (before[i].context !== before[j].context) continue
      if (![...families[i]].some((f) => families[j].has(f))) continue
      if (![...specs[i]].some((s) => specs[j].has(s))) continue
      if (!sameBox(boxes[i], boxes[j])) continue
      findings.push([before[i], before[j]])
    }
  }
  return findings
}

// The stylesheets index.html links load at startup, in that order: one unit, whichever chunks the
// bundler packed their rules into. The rest load with their lazy chunks.
function load(dir) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8')
  const linked = Array.from(html.matchAll(/<link rel="stylesheet"[^>]*href="\/?([^"]+)"/g), (m) => join(dir, m[1]))
  const lazy = cssFiles(dir).filter((file) => !linked.includes(file))
  return [
    { file: join(dir, '(startup: index.html links)'), css: linked.map((file) => canonical(readFileSync(file, 'utf8'))).join('\n') },
    ...lazy.map((file) => ({ file, css: canonical(readFileSync(file, 'utf8')) })),
  ]
}
const beforeFiles = load(resolve(beforeArg))
const afterFiles = load(resolve(afterArg))
const ruleSet = (list) => list.map((r) => `${r.context}\u0000${r.text}`).sort().join('\u0001')
let failed = false
const reviews = []
const unmatched = [...afterFiles]
for (const a of beforeFiles) {
  const exact = unmatched.findIndex((b) => b.css === a.css)
  if (exact >= 0) {
    unmatched.splice(exact, 1)
    continue
  }
  const rulesA = rules(a.css)
  const same = unmatched.findIndex((b) => ruleSet(rules(b.css)) === ruleSet(rulesA))
  if (same < 0) {
    console.log(`DIFFERENT RULES: ${relative(process.cwd(), a.file)} has no counterpart with the same rules`)
    failed = true
    continue
  }
  const [b] = unmatched.splice(same, 1)
  const found = swaps(rulesA, rules(b.css))
  console.log(`reordered: ${relative(process.cwd(), a.file)} -> ${relative(process.cwd(), b.file)}, ${found.length} swap(s) to review`)
  reviews.push(...found)
}
for (const b of unmatched) {
  console.log(`DIFFERENT RULES: ${relative(process.cwd(), b.file)} is new`)
  failed = true
}
for (const [x, y] of reviews) {
  console.log(`  [${x.context || 'top'}]\n    was first: ${x.text.slice(0, 200)}\n    now first: ${y.text.slice(0, 200)}`)
}
process.exit(failed ? 1 : reviews.length ? 2 : 0)
