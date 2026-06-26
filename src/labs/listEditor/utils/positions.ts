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
