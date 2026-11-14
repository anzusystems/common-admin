import type { AxiosInstance } from 'axios'
import type { DocId, IntegerId } from '@/types/common'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { isUndefined } from '@/utils/common'

const joinNames = (items: DamAuthor[]) =>
  items
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0)
    .join(', ')

export function damCredit(sources: DamAuthor[], authors: DamAuthor[]): string {
  const sourcesText = joinNames(sources.filter((source) => !source.flags.hiddenInCredit))
  const authorsText = joinNames(authors)
  if (sourcesText.length > 0 && authorsText.length > 0) return `${sourcesText} / ${authorsText}`
  return sourcesText.length > 0 ? sourcesText : authorsText
}

export function damCreditFromMap(
  authorsMap: Map<DocId, DamAuthor>,
  sourceIds: DocId[],
  authorIds: DocId[],
): string {
  const pick = (ids: DocId[]) =>
    ids.map((id) => authorsMap.get(id)).filter((item): item is DamAuthor => !isUndefined(item))
  return damCredit(pick(sourceIds), pick(authorIds))
}

export async function fetchDamCredit(
  client: () => AxiosInstance,
  extSystem: IntegerId,
  sourceIds: DocId[],
  authorIds: DocId[],
): Promise<string> {
  const ids = [...new Set([...sourceIds, ...authorIds])]
  if (ids.length === 0) return ''
  const authors = await fetchAuthorListByIds(client, extSystem, ids)
  return damCreditFromMap(
    new Map(authors.map((author) => [author.id, author])),
    sourceIds,
    authorIds,
  )
}
