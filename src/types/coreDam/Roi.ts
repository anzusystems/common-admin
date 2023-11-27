import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DocId } from '@/types/common'
import type { AssetFileLink } from '@/types/coreDam/AssetFile'

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
