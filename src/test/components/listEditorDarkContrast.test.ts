import { afterEach, describe, expect, it } from 'vitest'
// The list editors' styles (tokens, badges, the nested caret) ship with the component.
import '@/labs/listEditor/ANestedSortableListEditor.vue'

const SURFACE_DARK: [number, number, number] = [26, 26, 26]

const render = (theme: 'light' | 'dark', inner: string) => {
  const host = document.createElement('div')
  host.className = `v-theme--${theme}`
  host.style.background = `rgb(${SURFACE_DARK.join(',')})`
  host.innerHTML = `<div class="a-nested-list-editor">${inner}</div>`
  document.body.appendChild(host)
  return host
}
afterEach(() => {
  document.body.innerHTML = ''
})

const rgba = (css: string): [number, number, number, number] => {
  const [r, g, b, a = 1] = css.match(/[\d.]+/g)!.map(Number)
  return [r!, g!, b!, a]
}
// Composite over the dark surface, then the WCAG contrast ratio.
const over = ([r, g, b, a]: [number, number, number, number], bg: [number, number, number]) =>
  [r, g, b].map((c, i) => c * a + bg[i]! * (1 - a)) as [number, number, number]
const luminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1! + 0.05) / (l2! + 0.05)
}

describe('list editors in the dark theme', () => {
  it.each(['', 'a-le-status-badge--warning', 'a-le-status-badge--error'])(
    'status badge %s reads at 4.5:1 or better',
    (variant) => {
      const host = render('dark', `<span class="a-le-status-badge ${variant}">Unsaved</span>`)
      const style = getComputedStyle(host.querySelector('.a-le-status-badge')!)
      const bg = over(rgba(style.backgroundColor), SURFACE_DARK)
      const fg = over(rgba(style.color), bg)
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
  )

  it('draws the tree caret visibly, and still tints it on an editing row', () => {
    const host = render(
      'dark',
      `<button class="a-nested-list-editor__tree-toggle" id="plain"></button>
       <div class="a-le-row--editing"><button class="a-nested-list-editor__tree-toggle" id="editing"></button></div>`
    )
    const plain = over(rgba(getComputedStyle(host.querySelector('#plain')!).color), SURFACE_DARK)
    expect(contrast(plain, SURFACE_DARK)).toBeGreaterThanOrEqual(4.5)
    const editing = getComputedStyle(host.querySelector('#editing')!).color
    expect(editing).not.toBe(getComputedStyle(host.querySelector('#plain')!).color)
  })

  it('uses a light border token in the dark theme and keeps the light theme as it was', () => {
    const dark = render('dark', '')
    expect(
      getComputedStyle(dark.querySelector('.a-nested-list-editor')!).getPropertyValue('--le-border').trim()
    ).toContain('255')
    const light = render('light', '')
    expect(getComputedStyle(light.querySelector('.a-nested-list-editor')!).getPropertyValue('--le-border').trim()).toBe(
      'rgb(0 0 0 / 12%)'
    )
  })
})
