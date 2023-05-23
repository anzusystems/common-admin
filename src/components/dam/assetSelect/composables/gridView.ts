import { readonly, ref } from 'vue'

export enum GridView {
  Masonry = 'masonry',
  Thumbnail = 'thumbnail',
  Table = 'table',
  Default = Masonry,
}

const gridView = ref<GridView>(GridView.Default)

export function useGridView() {
  const setGridView = (value: GridView) => {
    gridView.value = value
  }

  return {
    gridView: readonly(gridView),
    setGridView,
  }
}
