import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DocId } from '@/types/common'
import type { AssetFileNullable } from '@/types/coreDam/AssetFile'

export interface AssetSlot extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  assetFile: AssetFileNullable
  slotName: string
  default: boolean
  main: boolean
}
