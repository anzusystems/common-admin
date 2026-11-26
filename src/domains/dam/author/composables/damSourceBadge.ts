import type { DocId } from '@/shared/types/common'
import type { DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import { byPriorityDesc } from '@/domains/dam/author/composables/damCredit'
import { isUndefined } from '@/shared/utils/common'

/** A source of an asset that has a badge: shown in lists as the badge, named by the source on hover. */
export interface DamSourceBadge {
  id: DocId
  name: string
  badge: string
}

/**
 * Badges of an asset's sources, from the author cache: a source not cached yet or without a badge has none.
 * Ordered as the credit orders them, higher priority first. A DAM before 1.53.0 sends no `sources` on list items.
 */
export const resolveSourceBadges = (
  sourceIds: DocId[] | undefined,
  getCachedAuthor: (id: DocId) => DamAuthorMinimal | undefined
): DamSourceBadge[] =>
  (sourceIds ?? [])
    .map((id) => getCachedAuthor(id))
    .filter((source): source is DamAuthorMinimal => !isUndefined(source) && (source.badge ?? '').length > 0)
    .sort(byPriorityDesc)
    .map(({ id, name, badge }) => ({ id, name, badge: badge ?? '' }))
