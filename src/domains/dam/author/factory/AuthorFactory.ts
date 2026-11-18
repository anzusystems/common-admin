import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import { DamAuthorTypeDefault } from '@/domains/dam/author/types/DamAuthorType'
import { dateTimeNow } from '@/shared/utils/datetime'
import { ENTITY } from '@/domains/dam/author/api/authorApi'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'

export function useDamAuthorFactory() {
  const createDefault = (extSystemId: number, reviewed?: boolean): DamAuthor => {
    return {
      id: '',
      name: '',
      identifier: '',
      extSystem: extSystemId,
      flags: {
        reviewed: reviewed ?? false,
        canBeCurrentAuthor: true,
      },
      currentAuthors: [],
      childAuthors: [],
      type: DamAuthorTypeDefault,
      createdAt: dateTimeNow(),
      modifiedAt: dateTimeNow(),
      createdBy: 0,
      modifiedBy: 0,
      _resourceName: ENTITY,
      _system: SYSTEM_CORE_DAM,
    }
  }

  return {
    createDefault,
  }
}
