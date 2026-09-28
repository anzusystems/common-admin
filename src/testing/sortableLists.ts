import { describe, expect, it } from 'vitest'
import { globKeyToSrcPath } from '@/testing/typedRouter'

export interface DescribeSortableListsOptions {
  /** The admin's sources: `import.meta.glob('/src/**\/*.{vue,ts}', { query: '?raw', import: 'default', eager: true })`. */
  sources: Record<string, string>
  /** Checks that every list editor registers with the unsaved changes guard or opts out of it. */
  unsavedRegistration?: boolean
}

/**
 * The list editors replaced older ways of making a list sortable, and a direct `useSortable` is a
 * perfectly valid VueUse import, so nothing fails a build if one comes back.
 *
 * What they cost is not style. The library's editors carry the reorder mode with its own undo, the
 * dirty and unsaved bookkeeping, per-row validation, the delete confirmation and keyboard moves; each
 * hand-rolled list re-implemented some fraction of that and skipped the rest -- two of the lists they
 * replaced wrote a drag into a display array that the save path never read, so reordering them looked
 * applied and was thrown away.
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
      // `unsaved-section-label` reads like a caption and is the whole registration: without it the
      // editor registers no section, and a guard declared with `sources: []` is left with nothing to
      // ask about. The rows still go amber, so the loss is silent: the view stops asking on the way
      // out and looks no different.
      //
      // `disable-unsaved` is the deliberate way out, for a list that is saved by the form around it
      // and has no unsaved state of its own to report; `readonly` never had unsaved state to begin
      // with.
      //
      // Read off the editor's own opening tag rather than the file: every one of these three words
      // appears elsewhere in a component for its own reasons, and a file-wide search would exempt an
      // editor because something further down happened to mention one of them.
      const unregistered = using(/<A(?:Nested)?(?:Sortable)?ListEditor/)
        .filter(([, source]) => unregisteredListEditorTags(source).length > 0)
        .map(([path]) => path)

      expect(unregistered).toEqual([])
    })
  })
}

/**
 * The opening tags of the list editors in a source that neither register with the unsaved changes guard
 * (`:unsaved-section-label`) nor opt out of it (bare `disable-unsaved` or `readonly`).
 *
 * Each tag is read from its `<` to the first `>` outside quotes: an attribute value can hold a `>` of
 * its own (`v-if="items.length > 0"`). Quotes are paired inside the tag only; paired across the file,
 * an apostrophe in a comment (`editor's`) would pair with a quote many lines on and swallow the tag.
 * Attribute values are blanked before the check, so `:readonly="readonly"` -- read-only when its
 * parent happens to say so -- is not taken for the bare attribute.
 *
 * An editor handed a lifted controller (`:editor=`) is left out: the controller belongs to whoever
 * holds it -- the outer editor in whose rows a nested list renders -- and that one registers.
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
