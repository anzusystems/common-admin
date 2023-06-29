import { readonly, ref } from 'vue'

export enum AssetSelectGridView {
  Masonry = 'masonry',
  Thumbnail = 'thumbnail',
  Table = 'table',
  Default = Masonry,
}

const gridView = ref<AssetSelectGridView>(AssetSelectGridView.Default)

export function useGridView() {
  const setGridView = (value: AssetSelectGridView) => {
    gridView.value = value
  }

  return {
    gridView: readonly(gridView),
    setGridView,
  }
}
