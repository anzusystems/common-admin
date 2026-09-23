import { describe, expect, it } from 'vitest'
import { resolveCompactText } from '@/labs/listEditor/composables/resolveCompactText'

describe('resolveCompactText', () => {
  it('returns the configured compactField value', () => {
    expect(resolveCompactText({ id: 1, label: 'Custom' }, { compactField: 'label' })).toBe('Custom')
  })

  it('returns empty string when compactField is empty/null/undefined', () => {
    expect(resolveCompactText({ id: 1, label: '' }, { compactField: 'label' })).toBe('')
    expect(resolveCompactText({ id: 1, label: null }, { compactField: 'label' })).toBe('')
    expect(resolveCompactText({ id: 1 }, { compactField: 'label' })).toBe('')
  })

  it('returns empty string when compactField is not set — no implicit fallback to common fields', () => {
    expect(resolveCompactText({ id: 1, title: 'T', name: 'N', text: 'X' }, {})).toBe('')
    expect(resolveCompactText({ id: 1, title: 'T' }, { compactField: null })).toBe('')
  })

  it('coerces non-string field values to string', () => {
    expect(resolveCompactText({ id: 1, label: 42 }, { compactField: 'label' })).toBe('42')
  })

  it('reads a dotted path through nested objects', () => {
    // How most entities in these admins carry their label, which until now forced an
    // `#item-compact` slot just to reach one field.
    expect(resolveCompactText({ texts: { title: 'Prvý' } }, { compactField: 'texts.title' })).toBe('Prvý')
    expect(resolveCompactText({ a: { b: { c: 7 } } }, { compactField: 'a.b.c' })).toBe('7')
  })

  it('returns empty string when a dotted path runs into nothing', () => {
    expect(resolveCompactText({ texts: null }, { compactField: 'texts.title' })).toBe('')
    expect(resolveCompactText({ texts: 'plain' }, { compactField: 'texts.title' })).toBe('')
    expect(resolveCompactText({}, { compactField: 'a.b' })).toBe('')
  })
})
