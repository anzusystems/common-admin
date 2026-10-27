import { describe, expect, it } from 'vitest'
import { globKeyToSrcPath } from '@/testing/typedRouter'

export interface DescribeSortableListsOptions {
  /**
   * The admin's sources: `import.meta.glob('/src/**\/*.{vue,ts}', { query: '?raw', import: 'default', eager: true })`.
   */
  sources: Record<string, string>
  unsavedRegistration?: boolean
}

/**
 * The list editors replaced older ways of making a list sortable. A direct
 * `useSortable` is a valid VueUse import, so no build fails if one comes back.
 * The editors carry reorder mode with undo, dirty and unsaved bookkeeping, per-row validation,
 * delete confirmation and keyboard moves. Hand-rolled lists re-implement only part of that.
 * Two replaced lists wrote a drag into a display array that the
 * save path never read, so reordering looked applied and was lost.
 */
export function describeSortableLists({ sources, unsavedRegistration = true }: DescribeSortableListsOptions): void {
  const using = (pattern: RegExp) =>
    Object.entries(sources)
      .map(([path, source]) => [globKeyToSrcPath(path), source] as const)
      .filter(([path]) => !path.startsWith('src/test/'))
      .filter(([, source]) => pattern.test(source))

  describe('sortable lists', () => {
    it('reads the sources it is meant to check', () => {
      // A guard on the guard: were the glob to stop matching, every assertion below would filter an
      // empty list and pass while checking nothing.
      expect(Object.keys(sources).length).toBeGreaterThan(50)
    })

    it('uses no removed sortable component', () => {
      // `ASortable` and `ASortableNested` left the library in 2.0.0.
      expect(using(/<ASortable(?:Nested)?(?![A-Za-z])/).map(([path]) => path)).toEqual([])
    })

    it('calls no sortable library directly', () => {
      // `ASortableListEditor` wraps `useSortable` itself; what is out of place is an admin reaching
      // past the editor for the same thing.
      expect(using(/from\s+'(?:@vueuse\/integrations\/useSortable|sortablejs)'/).map(([path]) => path)).toEqual([])
    })

    it.runIf(unsavedRegistration)('registers every list editor with the guard, or says it is not to be', () => {
      // `unsaved-section-label` is the whole registration. Without it the editor registers no section,
      // the view stops asking on the way out, and nothing looks different (the rows still go amber).
      // `disable-unsaved` is the deliberate opt-out for a list saved
      // by the surrounding form. `readonly` never had unsaved state.
      // Read from the editor's own opening tag, not the whole file: these words appear
      // elsewhere in a component for other reasons and would wrongly exempt an editor.
      const unregistered = using(/<A(?:Nested)?(?:Sortable)?ListEditor/)
        .filter(([, source]) => unregisteredListEditorTags(source).length > 0)
        .map(([path]) => path)

      expect(unregistered).toEqual([])
    })
  })
}

/**
 * The opening tags of list editors in a source that neither register with the unsaved changes
 * guard (`:unsaved-section-label`) nor opt out (bare `disable-unsaved` or `readonly`).
 * Each tag is read from its `<` to the first `>` outside quotes, since a value can hold
 * `>` (`v-if="items.length > 0"`). Quotes are paired inside the tag only: across the
 * file, an apostrophe in a comment would pair with a distant quote and swallow the tag.
 * Attribute values are blanked first, so `:readonly="readonly"` is not taken for the bare attribute.
 * An editor given a lifted controller (`:editor=`) is skipped. The outer editor that owns the controller registers.
 */
export function unregisteredListEditorTags(source: string): string[] {
  const tags: string[] = []
  for (const match of source.matchAll(/<A(?:Nested)?(?:Sortable)?ListEditor\b/g)) {
    let quote: string | null = null
    let end = match.index + match[0].length
    for (; end < source.length; end++) {
      const char = source[end]
      if (quote) {
        if (char === quote) quote = null
      } else if (char === '"' || char === "'") quote = char
      else if (char === '>') break
    }
    tags.push(source.slice(match.index, end + 1))
  }
  return tags.filter(
    (tag) =>
      !/:unsaved-section-label=|:editor=|(?<![:\w-])(?:disable-unsaved|readonly)\b/.test(
        tag.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''")
      )
  )
}
