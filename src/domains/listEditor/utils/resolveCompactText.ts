// Compact (collapsed) display text for a list-editor row. Used by every
// editor variant when the consumer didn't provide an `#item-compact` slot.
// Consumers must opt in explicitly via `compactField` — there is NO implicit
// fallback to common field names. Returns empty string otherwise; provide
// the `#item-compact` slot for anything richer.
export function resolveCompactText<TItem extends Record<string, any>>(
  raw: TItem,
  options: { compactField?: string | null }
): string {
  if (!options.compactField) return ''
  // A dotted path reads through nested objects (`texts.title`), which is how most entities in
  // these admins carry their label. A key without a dot behaves exactly as it always did, and a
  // path that runs into a missing or non-object step yields '' rather than throwing.
  let v: unknown = raw
  for (const segment of options.compactField.split('.')) {
    if (v === null || typeof v !== 'object') return ''
    v = (v as Record<string, unknown>)[segment]
  }
  return v == null || v === '' ? '' : String(v)
}
