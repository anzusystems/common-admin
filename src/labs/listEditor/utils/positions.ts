export interface RenumberPositionsOptions {
  /** Item field holding the position. Defaults to `'position'`. */
  positionField?: string
  /** Multiplier applied to the 1-based index (e.g. 10 → 10, 20, 30…). Defaults to `1`. */
  positionMultiplier?: number
}

/**
 * Returns the list renumbered to sequential positions matching the array
 * order. Items already carrying the right position are returned as-is
 * (reference-equal); changed items are shallow-copied — input is never
 * mutated.
 *
 * This is the same renumbering the list editors apply on commit when
 * `update-position` is enabled. Exported for consumers that assemble lists
 * outside an editor (e.g. save actions normalizing legacy data) so they don't
 * hand-roll `items.forEach((it, i) => { it.position = i + 1 })`.
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
