import type { DamKeyword } from '@/domains/dam/keyword/types/DamKeyword'
import { dateTimeNow } from '@/shared/utils/datetime'
import { ENTITY } from '@/domains/dam/keyword/api/keywordApi'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'

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
