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
