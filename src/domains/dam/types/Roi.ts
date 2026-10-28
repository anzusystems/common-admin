import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'
import type { DocId } from '@/shared/types/common'
import type { AssetFileLink } from '@/domains/dam/types/AssetFile'

export interface RegionOfInterest extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  title: string
  position: number
  image: DocId
  pointX: number
  pointY: number
  percentageWidth: number
  percentageHeight: number
  links: {
    image_roi_example: AssetFileLink[]
  }
}
