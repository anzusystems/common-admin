import { readonly, ref } from 'vue'

export const AssetSelectGridView = {
  Masonry: 'masonry',
  Thumbnail: 'thumbnail',
  Table: 'table',
} as const
export type AssetSelectGridViewType = (typeof AssetSelectGridView)[keyof typeof AssetSelectGridView]
export const AssetSelectGridViewDefault = AssetSelectGridView.Masonry

const gridView = ref<AssetSelectGridViewType>(AssetSelectGridViewDefault)

export function useGridView() {
  const setGridView = (value: AssetSelectGridViewType) => {
    gridView.value = value
  }

  return {
    gridView: readonly(gridView),
    setGridView,
  }
}
