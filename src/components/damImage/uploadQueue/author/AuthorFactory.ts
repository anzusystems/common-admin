import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { AuthorType } from '@/components/damImage/uploadQueue/author/AuthorType'
import { dateTimeNow } from '@/utils/datetime'
import { ENTITY } from '@/components/damImage/uploadQueue/api/authorApi'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

export function useAuthorFactory() {
  const createDefault = (extSystemId: number, reviewed?: boolean): DamAuthor => {
    return {
      id: '',
      name: '',
      identifier: '',
      extSystem: extSystemId,
      flags: {
        reviewed: reviewed ?? false,
      },
      type: AuthorType.Default,
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
