import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { dateTimeNow } from '@/utils/datetime'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

export function useDamKeywordFactory() {
  const createDefault = (extSystemId: number, reviewed?: boolean): DamKeyword => {
    return {
      id: '',
      name: '',
      extSystem: extSystemId,
      flags: {
        reviewed: reviewed ?? false,
      },
      createdAt: dateTimeNow(),
      modifiedAt: dateTimeNow(),
      createdBy: 1,
      modifiedBy: 1,
      _resourceName: ENTITY,
      _system: SYSTEM_CORE_DAM,
    }
  }

  return {
    createDefault,
  }
}
