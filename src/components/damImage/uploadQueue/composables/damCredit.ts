import type { AxiosInstance } from 'axios'
import type { DocId, IntegerId } from '@/types/common'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { isUndefined } from '@/utils/common'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'

export interface DamCreditConfig {
  creditFormat: string
  creditSeparator: string
}

export function getDamCreditConfig(extSystem: IntegerId): DamCreditConfig {
  const { getDamConfigExtSystem } = useDamConfigState()
  const sources = getDamConfigExtSystem(extSystem)?.[DamAssetType.Image]?.sources
  if (isUndefined(sources)) {
    throw new Error('getDamCreditConfig: Ext system must be initialised.')
  }
  return {
    creditFormat: sources.creditFormat,
    creditSeparator: sources.creditSeparator,
  }
}

const joinNames = (items: DamAuthor[], separator: string) =>
  items
    .filter((item) => !item.flags.hiddenInCredit)
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0)
    .join(separator)

export function damCredit(
  sources: DamAuthor[],
  authors: DamAuthor[],
  config: DamCreditConfig,
): string {
  const sourcesText = joinNames(sources, config.creditSeparator)
  const authorsText = joinNames(authors, config.creditSeparator)
  if (sourcesText.length > 0 && authorsText.length > 0) {
    return config.creditFormat
      .replace('{sources}', () => sourcesText)
      .replace('{authors}', () => authorsText)
  }
  return sourcesText.length > 0 ? sourcesText : authorsText
}

export function damCreditFromMap(
  authorsMap: Map<DocId, DamAuthor>,
  sourceIds: DocId[],
  authorIds: DocId[],
  config: DamCreditConfig,
): string {
  const pick = (ids: DocId[]) =>
    ids.map((id) => authorsMap.get(id)).filter((item): item is DamAuthor => !isUndefined(item))
  return damCredit(pick(sourceIds), pick(authorIds), config)
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
    getDamCreditConfig(extSystem),
  )
}
