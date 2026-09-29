import { describe, expect, it } from 'vitest'
import { parse, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'

// Every icon-only button in the library has an accessible name. A tooltip is not one: it gives
// `aria-describedby`, is rendered only on hover, and is hidden on touch devices. A clickable `VIcon`
// renders as `role="button"` and needs one too (its text is the icon font's glyph).

const sources = import.meta.glob(['../../**/*.vue', '!../../playground/**', '!../../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// `NodeTypes` is a const enum, not there at runtime in the browser build.
const NodeTypes = { ELEMENT: 1, TEXT: 2, COMMENT: 3, SIMPLE_EXPRESSION: 4, ATTRIBUTE: 6, DIRECTIVE: 7 } as const

const BUTTONS = new Set(['VBtn', 'ABtnIcon'])
// Rendered elsewhere (overlays) or not text: they do not name the button they sit in.
const NOT_CONTENT = new Set(['VTooltip', 'VMenu', 'VDialog', 'VIcon'])

const hasProp = (el: ElementNode, name: string) =>
  el.props.some((p) =>
    p.type === NodeTypes.ATTRIBUTE
      ? p.name === name
      : p.name === 'bind' && p.arg?.type === NodeTypes.SIMPLE_EXPRESSION && p.arg.content === name
  )
const listens = (el: ElementNode, event: string) =>
  el.props.some(
    (p) =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === 'on' &&
      p.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      p.arg.content === event
  )
const named = (el: ElementNode) => hasProp(el, 'aria-label') || hasProp(el, 'title') || hasProp(el, 'aria-labelledby')

// What the button shows as its own content, overlays and icons left out.
const content = (children: TemplateChildNode[]): TemplateChildNode[] =>
  children.flatMap((child) => {
    if (child.type === NodeTypes.COMMENT) return []
    if (child.type === NodeTypes.TEXT) return child.content.trim() ? [child] : []
    if (child.type === NodeTypes.ELEMENT && NOT_CONTENT.has(child.tag)) return []
    if (child.type === NodeTypes.ELEMENT && child.tag === 'template') return content(child.children)
    return [child]
  })
const hasIcon = (children: TemplateChildNode[]): boolean =>
  children.some(
    (child) =>
      child.type === NodeTypes.ELEMENT &&
      (child.tag === 'VIcon' || (child.tag === 'template' && hasIcon(child.children)))
  )

const unnamed = (source: string): number[] => {
  const start = source.indexOf('<template')
  const end = source.lastIndexOf('</template>')
  if (start === -1 || end === -1) return []
  const offset = source.slice(0, start).split('\n').length - 1
  const lines: number[] = []
  const visit = (nodes: TemplateChildNode[], insideButton: boolean) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) continue
      if (BUTTONS.has(node.tag)) {
        const iconOnly =
          content(node.children).length === 0 &&
          (hasProp(node, 'icon') || node.tag === 'ABtnIcon' || hasIcon(node.children))
        if (iconOnly && !named(node)) lines.push(node.loc.start.line + offset)
        visit(node.children, true)
        continue
      }
      if (node.tag === 'VIcon' && !insideButton && listens(node, 'click') && !named(node)) {
        lines.push(node.loc.start.line + offset)
      }
      visit(node.children, insideButton && !NOT_CONTENT.has(node.tag))
    }
  }
  visit(parse(source.slice(start, end + '</template>'.length)).children, false)
  return lines
}

describe('icon-only buttons', () => {
  it('found the components', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('finds an unnamed one, also behind a menu or without the icon prop', () => {
    const menu =
      '<template><VBtn icon><VIcon icon="mdi-cog" /><VMenu activator="parent"><VList>Item</VList></VMenu></VBtn></template>'
    const arrow = '<template><VBtn size="small" tabindex="-1"><VIcon icon="mdi-chevron-up" /></VBtn></template>'
    const clickableIcon = '<template><VIcon icon="mdi-close" @click="close" /></template>'
    expect([menu, arrow, clickableIcon].map(unnamed)).toEqual([[1], [1], [1]])
    expect(unnamed('<template><VBtn icon aria-label="Settings"><VIcon icon="mdi-cog" /></VBtn></template>')).toEqual([])
    expect(unnamed('<template><VBtn><VIcon icon="mdi-plus" />Add</VBtn></template>')).toEqual([])
  })

  it('all have an accessible name', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      unnamed(source).map((line) => `${path.replace('../../', 'src/')}:${line}`)
    )
    expect(offenders).toEqual([])
  })
})
