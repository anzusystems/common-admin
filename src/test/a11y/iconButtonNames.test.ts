import { describe, expect, it } from 'vitest'
import { parse, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'

// Every icon-only button in the library has an accessible name. A tooltip is not one: it gives
// `aria-describedby`, is rendered only on hover, and is hidden on touch devices. A clickable `VIcon`
// renders as `role="button"` and needs one too (its text is the icon font's glyph). So does a `VIcon`
// bound to the activator props of a menu or a dialog: those bring the click. A tooltip's bring none.

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
// `v-bind="props"`: everything the slot hands over, its click included.
const bindsAll = (el: ElementNode) =>
  el.props.some((p) => p.type === NodeTypes.DIRECTIVE && p.name === 'bind' && !p.arg)
const slotOf = (el: ElementNode) => {
  const slot = el.props.find((p) => p.type === NodeTypes.DIRECTIVE && p.name === 'slot')
  return slot?.type === NodeTypes.DIRECTIVE && slot.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? slot.arg.content : null
}

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
  // `clickActivator`: inside the activator slot of a menu or a dialog.
  const visit = (nodes: TemplateChildNode[], insideButton: boolean, parent: string, clickActivator: boolean) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) continue
      if (BUTTONS.has(node.tag)) {
        const iconOnly =
          content(node.children).length === 0 &&
          (hasProp(node, 'icon') || node.tag === 'ABtnIcon' || hasIcon(node.children))
        if (iconOnly && !named(node)) lines.push(node.loc.start.line + offset)
        visit(node.children, true, node.tag, false)
        continue
      }
      const clickable = listens(node, 'click') || (clickActivator && bindsAll(node))
      if (node.tag === 'VIcon' && !insideButton && clickable && !named(node)) {
        lines.push(node.loc.start.line + offset)
      }
      if (node.tag === 'template') {
        const activator = slotOf(node) === 'activator'
        visit(node.children, insideButton, parent, activator ? parent !== 'VTooltip' : clickActivator)
        continue
      }
      visit(node.children, insideButton && !NOT_CONTENT.has(node.tag), node.tag, false)
    }
  }
  visit(parse(source.slice(start, end + '</template>'.length)).children, false, '', false)
  return lines
}

// A closable chip's close button is named by `close-label`, Vuetify's "Close" without one. In the library closing a
// chip removes a value, and its close says so. A chip in the `#chip` slot of an autocomplete is made closable by the
// autocomplete (`closable-chips`), and one that draws its chips itself names their close "Close". So is a chip of a
// component of the library drawn in such a slot, and every chip of a component named a chip (`…Chip`): `holdsEveryChip`
// holds their whole template to the rule. A chip at the root of a template takes the attributes of its caller,
// `closable` among them, and is held to it too.
const AUTOCOMPLETES = new Set(['VAutocomplete', 'VSelect', 'VCombobox'])
const templateOf = (source: string) => {
  const start = source.indexOf('<template')
  const end = source.lastIndexOf('</template>')
  if (start === -1 || end === -1) return null
  return {
    nodes: parse(source.slice(start, end + '</template>'.length)).children,
    offset: source.slice(0, start).split('\n').length - 1,
  }
}
const closeUnnamed = (source: string, holdsEveryChip = false): number[] => {
  const template = templateOf(source)
  if (!template) return []
  const lines: number[] = []
  const roots = new Set(template.nodes.flatMap((node) => (node.type === NodeTypes.ELEMENT ? node.children : [])))
  const visit = (nodes: TemplateChildNode[], inChipSlot: boolean) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) continue
      const held = hasProp(node, 'closable') || inChipSlot || roots.has(node)
      if (node.tag === 'VChip' && held && !hasProp(node, 'close-label')) {
        lines.push(node.loc.start.line + template.offset)
      }
      const drawsOwnChips =
        AUTOCOMPLETES.has(node.tag) &&
        hasProp(node, 'closable-chips') &&
        !node.children.some((child) => child.type === NodeTypes.ELEMENT && slotOf(child) === 'chip')
      if (drawsOwnChips) lines.push(node.loc.start.line + template.offset)
      visit(node.children, inChipSlot || (node.tag === 'template' && slotOf(node) === 'chip'))
    }
  }
  visit(template.nodes, holdsEveryChip)
  return lines
}
// The components a template draws in a `#chip` slot (Vuetify's own, `V…`, aside).
const componentsInChipSlots = (source: string): string[] => {
  const template = templateOf(source)
  if (!template) return []
  const found: string[] = []
  const visit = (nodes: TemplateChildNode[], inChipSlot: boolean) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) continue
      if (inChipSlot && /^[A-Z]/.test(node.tag) && !/^V[A-Z]/.test(node.tag)) found.push(node.tag)
      visit(node.children, inChipSlot || (node.tag === 'template' && slotOf(node) === 'chip'))
    }
  }
  visit(template.nodes, false)
  return found
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

  it('finds an icon bound to the activator props of a menu, and not one of a tooltip', () => {
    const activator = (parent: string, label = '') =>
      `<template><${parent}><template #activator="{ props }"><VIcon icon="mdi-calendar" v-bind="props"${label} />` +
      `</template></${parent}></template>`
    expect(unnamed(activator('VMenu'))).toEqual([1])
    expect(unnamed(activator('VDialog'))).toEqual([1])
    expect(unnamed(activator('VMenu', ' :aria-label="t(\'$vuetify.datePicker.title\')"'))).toEqual([])
    expect(unnamed(activator('VTooltip'))).toEqual([])
  })

  it('all have an accessible name', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      unnamed(source).map((line) => `${path.replace('../../', 'src/')}:${line}`)
    )
    expect(offenders).toEqual([])
  })
})

describe('the close of closable chips', () => {
  it('finds one named by Vuetify alone: a closable chip, one in the chip slot, chips an autocomplete draws itself', () => {
    expect(closeUnnamed('<template><VChip closable>a</VChip></template>')).toEqual([1])
    expect(closeUnnamed('<template><VChip :closable="removable">a</VChip></template>')).toEqual([1])
    expect(
      closeUnnamed(
        '<template><VAutocomplete chips><template #chip="{ props }"><VChip v-bind="props" /></template></VAutocomplete></template>'
      )
    ).toEqual([1])
    expect(closeUnnamed('<template><VAutocomplete chips closable-chips /></template>')).toEqual([1])
    expect(closeUnnamed('<template><VChip closable close-label="common.button.remove">a</VChip></template>')).toEqual(
      []
    )
    expect(closeUnnamed('<template><div><VChip size="small">a</VChip></div></template>')).toEqual([])
  })

  it('holds a chip at the root of a template to the rule, also one of two branches, and no chip inside', () => {
    expect(closeUnnamed('<template><VChip label>a</VChip></template>')).toEqual([1])
    expect(closeUnnamed('<template><VChip v-if="chip">a</VChip><span v-else>a</span></template>')).toEqual([1])
    expect(closeUnnamed('<template><div><VChip label>a</VChip></div></template>')).toEqual([])
  })

  it('finds the components drawn in a chip slot, and holds every chip of theirs to the rule', () => {
    expect(
      componentsInChipSlots(
        '<template><VAutocomplete><template #chip="{ item }"><AuthorChip :id="item.value" /></template>' +
          '<template #item><OtherChip /></template></VAutocomplete></template>'
      )
    ).toEqual(['AuthorChip'])
    expect(closeUnnamed('<template><div><VChip size="small">a</VChip></div></template>', true)).toEqual([1])
  })

  it('all name what their close does', () => {
    const drawnInChipSlots = new Set(Object.values(sources).flatMap(componentsInChipSlots))
    const offenders = Object.entries(sources).flatMap(([path, source]) => {
      const component = path
        .split('/')
        .at(-1)!
        .replace(/\.vue$/, '')
      return closeUnnamed(source, drawnInChipSlots.has(component) || component.endsWith('Chip')).map(
        (line) => `${path.replace('../../', 'src/')}:${line}`
      )
    })
    expect(offenders).toEqual([])
  })
})
