import { useI18n } from 'vue-i18n'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import type { DocId } from '@/shared/types/common'
import { useAlerts } from '@/domains/system/composables/alerts'
import { isUndefined } from '@/shared/utils/common'

interface DamAuthorFieldTargets {
  own: (author: DamAuthor) => void
  other: (author: DamAuthor) => void
}

/**
 * After "+" in an author or source field: the API returns an existing author for a matching name. A merged
 * author is replaced by its current authors, as on asset save, and each one goes to the field of its kind.
 * Without a field kind (`source` undefined, sources off) all stay in the field.
 */
export function useDamAuthorFieldRouting() {
  const { t } = useI18n()
  const { showInfo, showRecordWas, showErrorsDefault } = useAlerts()

  const routeToFields = async (
    author: DamAuthor,
    source: boolean | undefined,
    fetchByIds: (ids: DocId[]) => Promise<DamAuthor[]>,
    targets: DamAuthorFieldTargets
  ) => {
    try {
      const resolved = author.currentAuthors.length > 0 ? await fetchByIds(author.currentAuthors) : [author]
      for (const item of resolved) {
        if (isUndefined(source) || item.flags.source === source) {
          targets.own(item)
          if (item.id === author.id) showRecordWas('created')
          continue
        }
        targets.other(item)
        showInfo(
          t(item.flags.source ? 'common.damImage.author.sourceFound' : 'common.damImage.author.authorFound', {
            name: item.name,
          })
        )
      }
    } catch (error) {
      showErrorsDefault(error)
    }
  }

  return { routeToFields }
}
