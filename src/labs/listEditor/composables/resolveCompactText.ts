// Compact (collapsed) display text for a list-editor row. Used by every
// editor variant when the consumer didn't provide an `#item-compact` slot.
// Consumers must opt in explicitly via `compactField` — there is NO implicit
// fallback to common field names. Returns empty string otherwise; provide
// the `#item-compact` slot for anything richer.
export function resolveCompactText<TItem extends Record<string, any>>(
  raw: TItem,
  options: { compactField?: string | null },
): string {
  if (!options.compactField) return ''
  const v = raw[options.compactField]
  return v == null || v === '' ? '' : String(v)
}
