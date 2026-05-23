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
})
