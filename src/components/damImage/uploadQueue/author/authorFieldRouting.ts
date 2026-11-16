import { useI18n } from 'vue-i18n'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { DocId } from '@/types/common'
import { useAlerts } from '@/composables/system/alerts'
import { isUndefined } from '@/utils/common'

interface DamAuthorFieldTargets {
  own: (author: DamAuthor) => void
  sources: (author: DamAuthor) => void
  authors: (author: DamAuthor) => void
}

/**
 * After "+" in an author or source field: the API returns an existing author for a matching name. A merged
 * author is replaced by its current authors, as on asset save, and each one goes to the field of its kind.
 * Without a field kind (`source` undefined, sources off) all stay in the field.
 */
export function useDamAuthorFieldRouting() {
  const { t } = useI18n()
  const { showInfo, showRecordWas } = useAlerts()

  const routeToFields = async (
    author: DamAuthor,
    source: boolean | undefined,
    fetchByIds: (ids: DocId[]) => Promise<DamAuthor[]>,
    targets: DamAuthorFieldTargets,
  ) => {
    const resolved = author.currentAuthors.length > 0 ? await fetchByIds(author.currentAuthors) : [author]
    for (const item of resolved) {
      if (isUndefined(source) || item.flags.source === source) {
        targets.own(item)
        if (item.id === author.id) showRecordWas('created')
      } else if (item.flags.source) {
        targets.sources(item)
        showInfo(t('common.damImage.author.sourceFound', { name: item.name }))
      } else {
        targets.authors(item)
        showInfo(t('common.damImage.author.authorFound', { name: item.name }))
      }
    }
  }

  return { routeToFields }
}
