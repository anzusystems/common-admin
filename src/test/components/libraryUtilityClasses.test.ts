import { afterEach, describe, expect, it } from 'vitest'
import '@/styles/main.scss'

// What the library's own utilities used to do, kept here as the yardstick for their replacements.
const LEGACY = `
.legacy-border-t { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important; }
.legacy-border-r { border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important; }
.legacy-border-b { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important; }
.legacy-border-l { border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important; }
.legacy-border-a { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important; }
.legacy-line-clamp-1 {
  overflow: hidden; -webkit-line-clamp: 1; display: -webkit-box; -webkit-box-orient: vertical;
  text-overflow: ellipsis; white-space: nowrap;
}
`

const render = (html: string) => {
  const legacy = document.createElement('style')
  legacy.textContent = LEGACY
  document.head.appendChild(legacy)
  const host = document.createElement('div')
  host.style.cssText = '--v-border-color: 0, 0, 0; --v-border-opacity: 0.12; width: 400px'
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}
afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('style:not([data-vite-dev-id])').forEach((s) => s.remove())
})

const librarySelectors = () => {
  const sheet = document.querySelector<HTMLStyleElement>('style[data-vite-dev-id$="src/styles/main.scss"]')!.sheet!
  const out: string[] = []
  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) out.push(rule.selectorText)
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
    }
  }
  walk(sheet.cssRules)
  return out
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const
const borders = (el: Element) => {
  const s = getComputedStyle(el)
  return SIDES.map((side) => [
    s.getPropertyValue(`border-${side}-width`),
    s.getPropertyValue(`border-${side}-style`),
    s.getPropertyValue(`border-${side}-color`),
  ])
}

describe('library utility classes', () => {
  it('leaves the ones Vuetify has to Vuetify, and prefixes its own', () => {
    const selectors = librarySelectors()
    expect(selectors.length).toBeGreaterThan(0)
    const unprefixed = selectors.filter((s) =>
      /\.(cursor-pointer|system-border-[a-z]|line-clamp-\d|white-space-pre|image-loading-effect|v-toolbar--custom-tiny)\b|span\.required\b/.test(
        s
      )
    )
    expect(unprefixed).toEqual([])
  })

  // On a plain element and on the Vuetify components the admins put them on.
  it.each(['div', 'v-toolbar', 'v-card', 'v-sheet', 'v-tabs'])(
    'the Vuetify border utilities draw what system-border-* drew on %s',
    (component) => {
      const cls = component === 'div' ? '' : component
      const pairs = [
        ['legacy-border-t', 'border-t'],
        ['legacy-border-r', 'border-e'],
        ['legacy-border-b', 'border-b'],
        ['legacy-border-l', 'border-s'],
        ['legacy-border-a', 'border'],
      ]
      const host = render(
        pairs.map(([legacy, now]) => `<div class="${cls} ${legacy}"></div><div class="${cls} ${now}"></div>`).join('')
      )
      const els = [...host.children]
      pairs.forEach((_, i) => {
        expect(borders(els[2 * i + 1]!)).toEqual(borders(els[2 * i]!))
      })
      expect(borders(els[1]!)[0]).toEqual(['1px', 'solid', 'rgba(0, 0, 0, 0.12)'])
    }
  )

  it.each(['block', 'flex'])('text-truncate lays out a %s child like line-clamp-1 did', (display) => {
    const text = 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv'
    const host = render(
      `<div style="display:${display};width:120px;line-height:30px;min-height:38px"><div class="legacy-line-clamp-1">${text}</div></div>` +
        `<div style="display:${display};width:120px;line-height:30px;min-height:38px"><div class="text-truncate">${text}</div></div>`
    )
    const [legacy, now] = [...host.querySelectorAll<HTMLElement>(':scope > div > div')]
    for (const prop of ['offsetWidth', 'offsetHeight', 'clientHeight', 'scrollWidth'] as const) {
      expect(now![prop], prop).toBe(legacy![prop])
    }
    expect(getComputedStyle(now!).textOverflow).toBe('ellipsis')
    expect(now!.scrollWidth).toBeGreaterThan(now!.clientWidth)
  })

  it('a-line-clamp-2 clamps to two lines', () => {
    const host = render(
      `<div class="a-line-clamp-2" style="width:60px;line-height:20px;font-size:14px">aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll</div>`
    )
    const el = host.firstElementChild as HTMLElement
    expect(el.scrollHeight).toBeGreaterThan(40)
    expect(el.clientHeight).toBe(40)
  })

  it.each([
    ['in a label', '<label>Title<span class="a-required-mark"></span></label>'],
    ['on its own', '<div>Title<span class="a-required-mark"></span></div>'],
  ])('a-required-mark adds the red asterisk %s', (_, html) => {
    const host = render(html)
    const after = getComputedStyle(host.querySelector('.a-required-mark')!, '::after')
    expect(after.content).toBe('"*"')
    expect(after.color).toBe('rgb(255, 0, 0)')
  })
})
