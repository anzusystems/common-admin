import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

// Fallback chain for the row's compact (collapsed) display text. Used by
// every editor variant when the consumer didn't provide an `#item-compact`
// slot — picks the first non-empty value from the configured `compactField`
// or a sensible set of common fields, then falls back to the row's key.
//
// Pure function — no Vue reactivity. Pass the i18n `t` so the caller's
// translation context is preserved.
export function resolveCompactText<TItem extends Record<string, any>>(
  raw: TItem,
  key: ListEditorKey,
  options: {
    compactField?: string | null
    fallback: string
  },
): string {
  const pick = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
  const fromField = options.compactField ? pick(raw[options.compactField]) : null
  if (fromField !== null) return fromField
  const fallbacks = [
    pick(raw.title),
    pick(raw.name),
    pick(raw.texts?.title),
    pick(raw.text),
    pick(key),
  ]
  const hit = fallbacks.find((v): v is string => v !== null)
  return hit ?? options.fallback
}
