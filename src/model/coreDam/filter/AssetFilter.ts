import { reactive } from 'vue'
import { makeFilterHelper } from '@/lib'

const makeFilter = makeFilterHelper('common', 'assetSelect')

const filter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  text: {
    ...makeFilter({ name: 'text', variant: 'search' }),
  },
  type: {
    ...makeFilter({ name: 'type', default: [] }),
  },
  status: {
    ...makeFilter({ name: 'status', default: ['with_file'] }),
  },
  keywordIds: {
    ...makeFilter({ name: 'keywordIds', default: [], multiple: true }),
  },
  assetAndMainFileIds: {
    ...makeFilter({ name: 'assetAndMainFileIds' }),
  },
  authorIds: {
    ...makeFilter({ name: 'authorIds', default: [], multiple: true }),
  },
  createdByIds: {
    ...makeFilter({ name: 'createdByIds', default: [], multiple: true }),
  },
  mostDominantColor: {
    ...makeFilter({ name: 'mostDominantColor', default: [] }),
  },
  closestMostDominantColor: {
    ...makeFilter({ name: 'closestMostDominantColor', default: [] }),
  },
  codecName: {
    ...makeFilter({ name: 'codecName', default: [] }),
  },
  orientation: {
    ...makeFilter({ name: 'orientation', default: [] }),
  },
  described: {
    ...makeFilter({ name: 'described', default: null }),
  },
  visible: {
    ...makeFilter({ name: 'visible', default: true }),
  },
  generatedBySystem: {
    ...makeFilter({ name: 'generatedBySystem', default: false }),
  },
  inPodcast: {
    ...makeFilter({ name: 'inPodcast', default: null }),
  },
  fromRss: {
    ...makeFilter({ name: 'fromRss', default: null }),
  },
  slotNames: {
    ...makeFilter({ name: 'slotNames', default: [] }),
  },
  distributedInServices: {
    ...makeFilter({ name: 'distributedInServices', default: [], multiple: true }),
  },
  licences: {
    ...makeFilter({ name: 'licences', default: [] }),
  },
  shortestDimensionFrom: {
    ...makeFilter({ name: 'shortestDimensionFrom', default: null }),
  },
  shortestDimensionUntil: {
    ...makeFilter({ name: 'shortestDimensionUntil', default: null }),
  },
  pixelSizeFrom: {
    ...makeFilter({ name: 'pixelSizeFrom', default: null }),
  },
  pixelSizeUntil: {
    ...makeFilter({ name: 'pixelSizeUntil', default: null }),
  },
  widthFrom: {
    ...makeFilter({ name: 'widthFrom', default: null }),
  },
  widthUntil: {
    ...makeFilter({ name: 'widthUntil', default: null }),
  },
  heightFrom: {
    ...makeFilter({ name: 'heightFrom', default: null }),
  },
  heightUntil: {
    ...makeFilter({ name: 'heightUntil', default: null }),
  },
  ratioWidthFrom: {
    ...makeFilter({ name: 'ratioWidthFrom', default: null }),
  },
  ratioWidthUntil: {
    ...makeFilter({ name: 'ratioWidthUntil', default: null }),
  },
  ratioHeightFrom: {
    ...makeFilter({ name: 'ratioHeightFrom', default: null }),
  },
  ratioHeightUntil: {
    ...makeFilter({ name: 'ratioHeightUntil', default: null }),
  },
  rotationFrom: {
    ...makeFilter({ name: 'rotationFrom', default: null }),
  },
  rotationUntil: {
    ...makeFilter({ name: 'rotationUntil', default: null }),
  },
  durationFrom: {
    ...makeFilter({ name: 'durationFrom', default: null }),
  },
  durationUntil: {
    ...makeFilter({ name: 'durationUntil', default: null }),
  },
  bitrateFrom: {
    ...makeFilter({ name: 'bitrateFrom', default: null }),
  },
  bitrateUntil: {
    ...makeFilter({ name: 'bitrateUntil', default: null }),
  },
  slotsCountFrom: {
    ...makeFilter({ name: 'slotsCountFrom', default: null }),
  },
  slotsCountUntil: {
    ...makeFilter({ name: 'slotsCountUntil', default: null }),
  },
  createdAtFrom: {
    ...makeFilter({ name: 'createdAtFrom', default: null }),
  },
  createdAtUntil: {
    ...makeFilter({ name: 'createdAtUntil', default: null }),
  },
})

export function useAssetListFilter() {
  return filter
}
