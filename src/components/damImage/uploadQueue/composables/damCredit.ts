import type { AxiosInstance } from 'axios'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { DocId, IntegerId } from '@/types/common'
import type {
  DamAuthor,
  DamAuthorMinimal,
} from '@/components/damImage/uploadQueue/author/DamAuthor'
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

type DamCreditName = Pick<DamAuthorMinimal, 'name' | 'hiddenInCredit'>

const joinNames = (items: DamCreditName[], separator: string) =>
  items
    .filter((item) => !item.hiddenInCredit)
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0)
    .join(separator)

export function damCredit(
  sources: DamCreditName[],
  authors: DamCreditName[],
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
    ids
      .map((id) => authorsMap.get(id))
      .filter((item): item is DamAuthor => !isUndefined(item))
      .map((item) => ({ name: item.name, hiddenInCredit: item.flags.hiddenInCredit }))
  return damCredit(pick(sourceIds), pick(authorIds), config)
}

export function useDamCreditPreview(
  getCached: (id: DocId) => DamCreditName | undefined,
  extSystem: MaybeRefOrGetter<IntegerId>,
  sourceIds: MaybeRefOrGetter<DocId[]>,
  authorIds: MaybeRefOrGetter<DocId[]>,
) {
  const pick = (ids: DocId[]) =>
    ids.map((id) => getCached(id)).filter((item): item is DamCreditName => !isUndefined(item))
  return computed(() =>
    damCredit(
      pick(toValue(sourceIds)),
      pick(toValue(authorIds)),
      getDamCreditConfig(toValue(extSystem)),
    ),
  )
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
