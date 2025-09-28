import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { ENTITY, SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

export const filterFieldsList = [
  {
    name: 'text' as const,
    default: null,
    type: 'string',
    variant: 'search',
    titleT: 'common.assetSelect.filter.text',
  },
  { name: 'type' as const, default: [] },
  { name: 'status' as const, default: ['with_file'] },
  { name: 'keywordIds' as const, default: [], titleT: 'common.assetSelect.filter.keywordIds' },
  {
    name: 'assetAndMainFileIds' as const,
    default: null,
    type: 'string',
    titleT: 'common.assetSelect.filter.assetAndMainFileIds',
  },
  { name: 'authorIds' as const, default: [], titleT: 'common.assetSelect.filter.authorIds' },
  { name: 'createdByIds' as const, default: [], titleT: 'common.assetSelect.filter.createdByIds' },
  { name: 'mostDominantColor' as const, default: [] },
  { name: 'closestMostDominantColor' as const, default: [] },
  { name: 'codecName' as const, default: [] },
  { name: 'orientation' as const, default: [] },
  { name: 'described' as const, default: null, titleT: 'common.assetSelect.filter.described' },
  { name: 'visible' as const, default: true, titleT: 'common.assetSelect.filter.visible' },
  { name: 'generatedBySystem' as const, default: false, titleT: 'common.assetSelect.filter.generatedBySystem' },
  { name: 'inPodcast' as const, default: null },
  { name: 'fromRss' as const, default: null },
  { name: 'slotNames' as const, default: [] },
  { name: 'distributedInServices' as const, default: [], titleT: 'common.assetSelect.filter.distributedInServices' },
  { name: 'licences' as const, default: [] },
  { name: 'shortestDimensionFrom' as const, default: null, type: 'integer' },
  { name: 'shortestDimensionUntil' as const, default: null, type: 'integer' },
  { name: 'pixelSizeFrom' as const, default: null, type: 'integer' },
  { name: 'pixelSizeUntil' as const, default: null, type: 'integer' },
  { name: 'widthFrom' as const, default: null, type: 'integer' },
  { name: 'widthUntil' as const, default: null, type: 'integer' },
  { name: 'heightFrom' as const, default: null, type: 'integer' },
  { name: 'heightUntil' as const, default: null, type: 'integer' },
  { name: 'ratioWidthFrom' as const, default: null, type: 'integer' },
  { name: 'ratioWidthUntil' as const, default: null, type: 'integer' },
  { name: 'ratioHeightFrom' as const, default: null, type: 'integer' },
  { name: 'ratioHeightUntil' as const, default: null, type: 'integer' },
  { name: 'rotationFrom' as const, default: null, type: 'integer' },
  { name: 'rotationUntil' as const, default: null, type: 'integer' },
  { name: 'durationFrom' as const, default: null, type: 'integer' },
  { name: 'durationUntil' as const, default: null, type: 'integer' },
  { name: 'bitrateFrom' as const, default: null, type: 'integer' },
  { name: 'bitrateUntil' as const, default: null, type: 'integer' },
  { name: 'slotsCountFrom' as const, default: null, type: 'integer' },
  { name: 'slotsCountUntil' as const, default: null, type: 'integer' },
  { name: 'createdAtFrom' as const, default: null, type: 'timeInterval', related: 'createdAtUntil' },
  { name: 'createdAtUntil' as const, default: null, type: 'timeInterval', exclude: true, render: { skip: true } },
  { name: 'mainFileSingleUse' as const, default: false },
] satisfies readonly MakeFilterOption[]

const listFiltersStore = createFilterStore(filterFieldsList)

export function useAssetListFilter() {
  const { filterConfig, filterData } = createFilter(filterFieldsList, listFiltersStore, {
    elastic: true,
    system: SYSTEM_CORE_DAM,
    subject: ENTITY,
  })

  return {
    filterConfig,
    filterData,
  }
}
