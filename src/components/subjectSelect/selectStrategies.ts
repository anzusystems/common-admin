export interface VDatatableSelectableItem {
  value: any
  selectable: boolean
}

interface DataTableSelectStrategy {
  showSelectAll: boolean
  allSelected: (data: {
    allItems: VDatatableSelectableItem[]
    currentPage: VDatatableSelectableItem[]
  }) => VDatatableSelectableItem[]
  select: (data: { items: VDatatableSelectableItem[]; value: boolean; selected: Set<unknown> }) => Set<unknown>
  selectAll: (data: {
    value: boolean
    allItems: VDatatableSelectableItem[]
    currentPage: VDatatableSelectableItem[]
    selected: Set<unknown>
  }) => Set<unknown>
}

export const generateDatatableMinMaxSelectStrategy = (min: number, max: number): DataTableSelectStrategy => {
  return {
    showSelectAll: false,
    allSelected: () => [],
    select: ({ items, value, selected }) => {
      console.log(items)
      console.log(value)
      console.log(selected)
      if (min === max && min === 1) {
        return new Set(value ? [items[0]?.value] : [])
      }
      for (const item of items) {
        if (selected.size >= max && value) break
        else if (value) selected.add(item.value)
        else selected.delete(item.value)
      }
      return selected
    },
    selectAll: ({ selected }) => selected,
  }
}
