import { describe, expect, it } from 'vitest'
import { globKeyToSrcPath } from '@/testing/typedRouter'

export interface DescribeAlertHostOptions {
  /** The admin's components: `import.meta.glob(['/src/**\/*.vue', '!/src/test/**'], { query: '?raw', import: 'default', eager: true })`. */
  sources: Record<string, string>
  /** The component with the layout switch, which mounts `<AAlerts />`. */
  host?: string
}

/**
 * Where the alerts land.
 *
 * `AAlerts` is the host every `showError` / `showWarning` renders into. It is mounted once, outside the
 * layout switch: by `ALayoutSwitch`, or next to the admin's own `<component :is="layout">`. A host inside a
 * layout took the alerts it was showing away with it when the route switched layouts -- a start-up
 * error raised under the loader vanished the moment the drawer replaced it -- and a layout without one
 * had nowhere to show them at all.
 */
export function describeAlertHost({ sources, host = 'src/layouts/AppLayout.vue' }: DescribeAlertHostOptions): void {
  const bySrcPath = new Map(Object.entries(sources).map(([path, source]) => [globKeyToSrcPath(path), source]))

  describe('the alerts host', () => {
    it(`is mounted once, in ${host}, before the layout switch`, () => {
      const source = bySrcPath.get(host)
      expect(source).toBeDefined()
      const template = source!.slice(source!.indexOf('<template>'))

      // `ALayoutSwitch` mounts it itself, before the layout it switches.
      if (/<ALayoutSwitch\b/.test(template)) {
        expect(template.match(/<ALayoutSwitch\b/g)).toHaveLength(1)
        expect(template).not.toMatch(/<AAlerts/)
        return
      }
      expect(template.match(/<AAlerts\s*\/>/g)).toHaveLength(1)
      expect(template.indexOf('<AAlerts')).toBeLessThan(template.indexOf('<component :is'))
    })

    it('is nowhere else: no layout, page or component of its own', () => {
      // A guard on the guard: the glob has to see the layouts for the assertion below to mean anything.
      expect([...bySrcPath.keys()].filter((path) => path.startsWith('src/layouts/')).length).toBeGreaterThan(2)

      const withHost = [...bySrcPath]
        .filter(([path, source]) => !path.startsWith('src/test/') && /<(AAlerts|ALayoutSwitch)\b/.test(source))
        .map(([path]) => path)

      expect(withHost).toEqual([host])
    })
  })
}

/** The `@layer` statement an admin's index.html opens with: the library's layer sits between Vuetify's overrides and its utilities. */
export const CSS_LAYER_ORDER = [
  'vuetify-core',
  'vuetify-components',
  'vuetify-overrides',
  'anzu-common',
  'vuetify-utilities',
  'vuetify-final',
] as const

/**
 * Vuetify's sub-layers, in the order its `main.css` declares them. Its component stylesheets name them
 * too (13 of them name `vuetify-final.trumps`), and a component stylesheet can load before `main.css`: in a
 * cms build one named `trumps` ahead of `transitions` and put the two in reverse.
 */
export const CSS_SUBLAYER_ORDER = {
  'vuetify-core': ['reset', 'base'],
  'vuetify-utilities': ['theme-base', 'typography', 'helpers', 'theme-background', 'theme-foreground'],
  'vuetify-final': ['transitions', 'trumps'],
} as const

/** The statements an admin's index.html opens its first `<style>` with, one per line. */
export const CSS_LAYER_STATEMENTS: readonly string[] = [
  `@layer ${CSS_LAYER_ORDER.join(', ')};`,
  ...Object.entries(CSS_SUBLAYER_ORDER).map(
    ([parent, layers]) => `@layer ${layers.map((layer) => `${parent}.${layer}`).join(', ')};`
  ),
]

/**
 * The library's stylesheet is one cascade layer, `anzu-common`. The `@layer` statement in index.html
 * comes before every stylesheet, so it alone decides where that layer lands: after Vuetify's overrides
 * and before its utility classes, so that a utility in a template beats the library's styles. A layer
 * the statement does not name is appended after `vuetify-final`, above the utilities.
 *
 * Layers are ordered by first mention, so the statements only decide if nothing names a layer before
 * them: they have to open the first style in the page, in `<head>`, ahead of any stylesheet link and any
 * other rule. The same holds for Vuetify's sub-layers, which follow in the same `<style>`.
 */
export function describeCssLayerOrder({ indexHtml }: { indexHtml: string | undefined }): void {
  describe('the cascade layer order in index.html', () => {
    // What the browser does not apply as a style of the page: comments, and the contents of <noscript>
    // and <template>.
    const html = (indexHtml ?? '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    const layerList = (statement: string | undefined) =>
      /^@layer\s+([^;{]+);$/
        .exec(statement ?? '')?.[1]
        ?.split(',')
        .map((layer) => layer.trim())
    // The `@layer a, b;` statements a stylesheet opens with, up to its first other rule.
    const leadingStatements = (css: string) =>
      /^(?:\s*@layer\s[^;{]*;)*/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))![0].match(/@layer\s[^;{]*;/g) ?? []

    it('puts the library between the Vuetify overrides and the utilities', () => {
      expect(layerList(/@layer\s[^;{]*;/.exec(html)?.[0])).toEqual([...CSS_LAYER_ORDER])
    })

    const first =
      /<style\b[^>]*>([\s\S]*?)<\/style>|<link\b[^>]*\brel\s*=\s*["']?(?:stylesheet|preload\b[^>]*\bas\s*=\s*["']?style)\b[^>]*>/i.exec(
        html
      )

    it('opens the first style in the page', () => {
      expect(first?.[0], 'the first <style> or stylesheet <link>').toMatch(/^<style/i)
      const head = html.search(/<\/head\s*>/i)
      if (head >= 0) expect(first!.index, 'the first <style> is in <head>').toBeLessThan(head)
      expect(layerList(leadingStatements(first?.[1] ?? '')[0]), 'the first rule of the first <style>').toEqual([
        ...CSS_LAYER_ORDER,
      ])
    })

    it("orders Vuetify's sub-layers right after it", () => {
      const statements = leadingStatements(first?.[1] ?? '').slice(1)
      expect(statements.slice(0, CSS_LAYER_STATEMENTS.length - 1).map(layerList)).toEqual(
        CSS_LAYER_STATEMENTS.slice(1).map(layerList)
      )
    })
  })
}
