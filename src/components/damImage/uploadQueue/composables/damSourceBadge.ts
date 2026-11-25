import type { DocId } from '@/types/common'
import type { DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { byPriorityDesc } from '@/components/damImage/uploadQueue/composables/damCredit'
import { isUndefined } from '@/utils/common'

export type DamSourceBadge = Pick<DamAuthorMinimal, 'id' | 'name' | 'badge'>

export const resolveSourceBadges = (
  sourceIds: DocId[],
  getCachedAuthor: (id: DocId) => DamAuthorMinimal | undefined,
): DamSourceBadge[] =>
  sourceIds
    .map((id) => getCachedAuthor(id))
    .filter(
      (source): source is DamAuthorMinimal => !isUndefined(source) && source.badge.length > 0,
    )
    .sort(byPriorityDesc)
    .map(({ id, name, badge }) => ({ id, name, badge }))
