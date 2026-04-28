import { describe, expect, it } from 'vitest'
import { resolveCompactText } from '@/labs/listEditor/composables/resolveCompactText'

describe('resolveCompactText', () => {
  const FALLBACK = 'Item'

  describe('compactField', () => {
    it('returns the configured field when set and non-empty', () => {
      const result = resolveCompactText(
        { id: 1, label: 'Custom', title: 'IgnoredTitle' },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      expect(result).toBe('Custom')
    })

    it('falls through when the configured field is empty/null/undefined', () => {
      const empty = resolveCompactText(
        { id: 1, label: '', title: 'TitleWins' },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      const isNull = resolveCompactText(
        { id: 1, label: null, title: 'TitleWins' },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      const undef = resolveCompactText(
        { id: 1, title: 'TitleWins' },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      expect(empty).toBe('TitleWins')
      expect(isNull).toBe('TitleWins')
      expect(undef).toBe('TitleWins')
    })

    it('coerces non-string field values to string', () => {
      const result = resolveCompactText(
        { id: 1, label: 42 },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      expect(result).toBe('42')
    })
  })

  describe('priority chain (compactField → title → name → texts.title → text → key → fallback)', () => {
    it('compactField beats every default field', () => {
      const result = resolveCompactText(
        {
          id: 1,
          label: 'COMPACT',
          title: 'Title',
          name: 'Name',
          texts: { title: 'Texts' },
          text: 'Text',
        },
        1,
        { compactField: 'label', fallback: FALLBACK },
      )
      expect(result).toBe('COMPACT')
    })

    it('title → name → texts.title → text', () => {
      const all = {
        title: 'A',
        name: 'B',
        texts: { title: 'C' },
        text: 'D',
      }
      expect(resolveCompactText(all, 1, { fallback: FALLBACK })).toBe('A')
      expect(
        resolveCompactText({ ...all, title: '' }, 1, { fallback: FALLBACK }),
      ).toBe('B')
      expect(
        resolveCompactText({ ...all, title: '', name: '' }, 1, {
          fallback: FALLBACK,
        }),
      ).toBe('C')
      expect(
        resolveCompactText(
          { title: '', name: '', texts: { title: '' }, text: 'D' },
          1,
          { fallback: FALLBACK },
        ),
      ).toBe('D')
    })

    it('falls through to the row key as last resort, then fallback', () => {
      // Numeric 0 is coerced to '0' (not '' or null) → used as the label.
      expect(resolveCompactText({ id: 0 }, 0, { fallback: FALLBACK })).toBe(
        '0',
      )
      // Empty-string key + no other fields → fallback.
      expect(
        resolveCompactText({ id: null }, '', { fallback: FALLBACK }),
      ).toBe(FALLBACK)
    })
  })
})
