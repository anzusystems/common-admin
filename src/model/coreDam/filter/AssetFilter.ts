import {
  createFilter,
  createFilterStore,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { SYSTEM_CORE_DAM, ENTITY } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { reactive } from 'vue'

export const filterFieldsList = [
  {
    name: 'text' as const,
    default: null,
    type: 'string',
    variant: 'search',
  },
  { name: 'type' as const, default: [] },
  { name: 'status' as const, default: ['with_file'] },
  { name: 'keywordIds' as const, default: [] },
  { name: 'assetAndMainFileIds' as const, default: null, type: 'string' },
  { name: 'authorIds' as const, default: [] },
  { name: 'createdByIds' as const, default: [] },
  { name: 'mostDominantColor' as const, default: [] },
  { name: 'closestMostDominantColor' as const, default: [] },
  { name: 'codecName' as const, default: [] },
  { name: 'orientation' as const, default: [] },
  { name: 'described' as const, default: null },
  { name: 'visible' as const, default: true },
  { name: 'generatedBySystem' as const, default: false },
  { name: 'inPodcast' as const, default: null },
  { name: 'fromRss' as const, default: null },
  { name: 'slotNames' as const, default: [] },
  { name: 'distributedInServices' as const, default: [] },
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

// backup:
// const filter = reactive({
//   _elastic: {
//     ...makeFilter({ exclude: true }),
//   },
//   text: {
//     ...makeFilter({ name: 'text', variant: 'search' }),
//   },
//   type: {
//     ...makeFilter({ name: 'type', default: [] }),
//   },
//   status: {
//     ...makeFilter({ name: 'status', default: ['with_file'] }),
//   },
//   keywordIds: {
//     ...makeFilter({ name: 'keywordIds', default: [], multiple: true }),
//   },
//   assetAndMainFileIds: {
//     ...makeFilter({ name: 'assetAndMainFileIds' }),
//   },
//   authorIds: {
//     ...makeFilter({ name: 'authorIds', default: [], multiple: true }),
//   },
//   createdByIds: {
//     ...makeFilter({ name: 'createdByIds', default: [], multiple: true }),
//   },
//   mostDominantColor: {
//     ...makeFilter({ name: 'mostDominantColor', default: [] }),
//   },
//   closestMostDominantColor: {
//     ...makeFilter({ name: 'closestMostDominantColor', default: [] }),
//   },
//   codecName: {
//     ...makeFilter({ name: 'codecName', default: [] }),
//   },
//   orientation: {
//     ...makeFilter({ name: 'orientation', default: [] }),
//   },
//   described: {
//     ...makeFilter({ name: 'described', default: null }),
//   },
//   visible: {
//     ...makeFilter({ name: 'visible', default: true }),
//   },
//   generatedBySystem: {
//     ...makeFilter({ name: 'generatedBySystem', default: false }),
//   },
//   inPodcast: {
//     ...makeFilter({ name: 'inPodcast', default: null }),
//   },
//   fromRss: {
//     ...makeFilter({ name: 'fromRss', default: null }),
//   },
//   slotNames: {
//     ...makeFilter({ name: 'slotNames', default: [] }),
//   },
//   distributedInServices: {
//     ...makeFilter({ name: 'distributedInServices', default: [], multiple: true }),
//   },
//   licences: {
//     ...makeFilter({ name: 'licences', default: [] }),
//   },
//   shortestDimensionFrom: {
//     ...makeFilter({ name: 'shortestDimensionFrom', default: null }),
//   },
//   shortestDimensionUntil: {
//     ...makeFilter({ name: 'shortestDimensionUntil', default: null }),
//   },
//   pixelSizeFrom: {
//     ...makeFilter({ name: 'pixelSizeFrom', default: null }),
//   },
//   pixelSizeUntil: {
//     ...makeFilter({ name: 'pixelSizeUntil', default: null }),
//   },
//   widthFrom: {
//     ...makeFilter({ name: 'widthFrom', default: null }),
//   },
//   widthUntil: {
//     ...makeFilter({ name: 'widthUntil', default: null }),
//   },
//   heightFrom: {
//     ...makeFilter({ name: 'heightFrom', default: null }),
//   },
//   heightUntil: {
//     ...makeFilter({ name: 'heightUntil', default: null }),
//   },
//   ratioWidthFrom: {
//     ...makeFilter({ name: 'ratioWidthFrom', default: null }),
//   },
//   ratioWidthUntil: {
//     ...makeFilter({ name: 'ratioWidthUntil', default: null }),
//   },
//   ratioHeightFrom: {
//     ...makeFilter({ name: 'ratioHeightFrom', default: null }),
//   },
//   ratioHeightUntil: {
//     ...makeFilter({ name: 'ratioHeightUntil', default: null }),
//   },
//   rotationFrom: {
//     ...makeFilter({ name: 'rotationFrom', default: null }),
//   },
//   rotationUntil: {
//     ...makeFilter({ name: 'rotationUntil', default: null }),
//   },
//   durationFrom: {
//     ...makeFilter({ name: 'durationFrom', default: null }),
//   },
//   durationUntil: {
//     ...makeFilter({ name: 'durationUntil', default: null }),
//   },
//   bitrateFrom: {
//     ...makeFilter({ name: 'bitrateFrom', default: null }),
//   },
//   bitrateUntil: {
//     ...makeFilter({ name: 'bitrateUntil', default: null }),
//   },
//   slotsCountFrom: {
//     ...makeFilter({ name: 'slotsCountFrom', default: null }),
//   },
//   slotsCountUntil: {
//     ...makeFilter({ name: 'slotsCountUntil', default: null }),
//   },
//   createdAtFrom: {
//     ...makeFilter({ name: 'createdAtFrom', default: null }),
//   },
//   createdAtUntil: {
//     ...makeFilter({ name: 'createdAtUntil', default: null }),
//   },
//   mainFileSingleUse: {
//     ...makeFilter({ name: 'mainFileSingleUse', default: false }),
//   },
// })

