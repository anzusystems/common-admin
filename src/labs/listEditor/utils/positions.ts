export interface RenumberPositionsOptions {
  /** Item field holding the position. Defaults to `'position'`. */
  positionField?: string
  /** Multiplier applied to the 1-based index (e.g. 10 → 10, 20, 30…). Defaults to `1`. */
  positionMultiplier?: number
}

/** Non-mutating sort by ascending `position` (in-place `sort` would trigger reactivity). */
export const sortByPosition = <TItem extends { position: number }>(items: TItem[]): TItem[] =>
  [...items].sort((a, b) => a.position - b.position)

/**
 * Non-mutating deep `sortByPosition`. Sorts the top-level array, then for every
 * item carrying one of `childKeys` as an array, recursively sorts that nested
 * array too. The same `childKeys` apply at every depth and keys absent on a node
 * are skipped — so pass the UNION of nested position-bearing array fields across
 * the whole shape (e.g. `['contentItems', 'boxPositionIncludes']`).
 *
 * Same non-mutating contract as `sortByPosition`: only nodes that actually have a
 * nested array are shallow-cloned; leaf nodes and untouched branches keep their
 * reference. Use it to normalize an API response's ordering before it becomes
 * store state, in one call, for nested collections.
 */
export const sortByPositionDeep = <TItem extends { position: number }>(
  items: TItem[],
  childKeys: string[] = [],
): TItem[] =>
  sortByPosition(items).map((item) => {
    let next = item
    for (const key of childKeys) {
      const child = (item as Record<string, any>)[key]
      if (Array.isArray(child)) {
        if (next === item) next = { ...item }
        ;(next as Record<string, any>)[key] = sortByPositionDeep(child, childKeys)
      }
    }
    return next
  })

/**
 * Non-mutating renumber to sequential positions matching array order — the same
 * renumbering the editors apply on commit. Unchanged items stay reference-equal.
 */
export const renumberPositions = <TItem extends Record<string, any>>(
  items: TItem[],
  options: RenumberPositionsOptions = {},
): TItem[] => {
  const positionField = options.positionField ?? 'position'
  const positionMultiplier = options.positionMultiplier ?? 1
  return items.map((item, idx) => {
    const newPosition = (idx + 1) * positionMultiplier
    if (item[positionField] === newPosition) return item
    return { ...item, [positionField]: newPosition }
  })
}

/**
 * Reassign the EXISTING position values to the current array order.
 *
 * For consumers whose position is a meaningful absolute number rather than an opaque ordinal (e.g. a
 * CMS page whose backend interleaves these rows with another collection on the same numeric scale),
 * a reorder must move rows THROUGH the existing slots instead of rewriting them: `A:10, B:310` with
 * A and B swapped becomes `B:10, A:310` — the value set {10, 310} is untouched.
 *
 * Non-mutating; unchanged items stay reference-equal. Rows whose position is missing or non-numeric
 * are left alone and warn in dev — silently inventing a value here would produce a wrong payload.
 */
export const preservePositionValues = <TItem extends Record<string, any>>(
  items: TItem[],
  options: RenumberPositionsOptions = {},
): TItem[] => {
  const positionField = options.positionField ?? 'position'
  const values = items.map((i) => i[positionField])
  const usable = values.every((v) => typeof v === 'number' && Number.isFinite(v))
  if (!usable) {
    console.warn(
      `[listEditor] position strategy "preserve-values" needs a finite numeric \`${positionField}\` ` +
        'on every row; found ' +
        JSON.stringify(values) +
        ' — leaving positions untouched.',
    )
    return items
  }
  if (new Set(values).size !== values.length) {
    console.warn(
      `[listEditor] position strategy "preserve-values" found DUPLICATE \`${positionField}\` values ` +
        JSON.stringify(values) +
        ' — the resulting order is not well defined relative to any interleaved collection.',
    )
  }
  const slots = [...(values as number[])].sort((a, b) => a - b)
  return items.map((item, idx) =>
    item[positionField] === slots[idx] ? item : { ...item, [positionField]: slots[idx] },
  )
}
