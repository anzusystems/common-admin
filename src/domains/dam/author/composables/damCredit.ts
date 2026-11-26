import type { AxiosInstance } from 'axios'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { DamAuthor, DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { isUndefined } from '@/shared/utils/common'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemAssetTypeSources, DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

export type DamCreditConfig = Pick<
  DamExtSystemAssetTypeSources,
  'creditFormat' | 'creditSourcesSeparator' | 'creditAuthorsSeparator'
>

/**
 * Used where the ext system gives no credit format: not loaded, or a DAM without sources.
 * Authors alone then read as before sources: their names joined by a comma.
 */
export const DAM_CREDIT_CONFIG_DEFAULT: Readonly<DamCreditConfig> = {
  creditFormat: '{sources}/{authors}',
  creditSourcesSeparator: '/',
  creditAuthorsSeparator: ', ',
}

/** Credit format of the images of an ext system configuration, else the default. */
export const damCreditConfigOf = (extSystemConfig: DamExtSystemConfig | undefined): DamCreditConfig =>
  extSystemConfig?.[DamAssetType.Image]?.sources ?? DAM_CREDIT_CONFIG_DEFAULT

/**
 * Credit format of an ext system's images in the DAM configuration store of `configName`.
 * Call in setup: the store is taken now, and the returned function may run after awaits.
 * Without a name, uses the inherited one, else `default`.
 * An ext system not loaded takes the format of `fallbackExtSystem` when that one is loaded, else the default.
 */
export function useDamCreditConfig(configName?: string) {
  const { getDamConfigExtSystem } = useDamConfigState(undefined, inheritedDamConfigName(configName))
  return (extSystem: IntegerId, fallbackExtSystem?: IntegerId): DamCreditConfig =>
    damCreditConfigOf(
      getDamConfigExtSystem(extSystem) ??
        (isUndefined(fallbackExtSystem) ? undefined : getDamConfigExtSystem(fallbackExtSystem))
    )
}

/** Whether neither sources nor authors are given. A list a DAM did not send counts as empty. */
export const hasNoDamCredit = (authorIds: DocId[] | undefined, sourceIds: DocId[] | undefined) =>
  (authorIds?.length ?? 0) === 0 && (sourceIds?.length ?? 0) === 0

type DamCreditName = Pick<DamAuthorMinimal, 'name' | 'hiddenInCredit' | 'priority'>

/** Higher priority first; `sort` is stable, so names of equal priority keep their order. A missing priority is 0. */
export const byPriorityDesc = (a: Pick<DamAuthorMinimal, 'priority'>, b: Pick<DamAuthorMinimal, 'priority'>) =>
  (b.priority ?? 0) - (a.priority ?? 0)

const joinNames = (items: DamCreditName[], separator: string) =>
  items
    .filter((item) => !item.hiddenInCredit)
    .sort(byPriorityDesc)
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0)
    .join(separator)

/** Credit text: sources and authors joined by their separators, both sides by the format, or one side alone. */
export function damCredit(sources: DamCreditName[], authors: DamCreditName[], config: DamCreditConfig): string {
  const sourcesText = joinNames(sources, config.creditSourcesSeparator)
  const authorsText = joinNames(authors, config.creditAuthorsSeparator)
  if (sourcesText.length > 0 && authorsText.length > 0) {
    return config.creditFormat.replace('{sources}', () => sourcesText).replace('{authors}', () => authorsText)
  }
  return sourcesText.length > 0 ? sourcesText : authorsText
}

export function damCreditFromMap(
  authorsMap: Map<DocId, DamAuthor>,
  sourceIds: DocId[] | undefined,
  authorIds: DocId[] | undefined,
  config: DamCreditConfig
): string {
  const pick = (ids: DocId[] | undefined) =>
    (ids ?? [])
      .map((id) => authorsMap.get(id))
      .filter((item): item is DamAuthor => !isUndefined(item))
      .map((item) => ({ name: item.name, hiddenInCredit: !!item.flags?.hiddenInCredit, priority: item.priority ?? 0 }))
  return damCredit(pick(sourceIds), pick(authorIds), config)
}

/**
 * Credit of the picked sources and authors from cached names, for a preview under the fields.
 * Call in setup. Without a configuration name, uses the inherited one, else `default`.
 */
export function useDamCreditPreview(
  getCached: (id: DocId) => DamCreditName | undefined,
  extSystem: MaybeRefOrGetter<IntegerId>,
  sourceIds: MaybeRefOrGetter<DocId[]>,
  authorIds: MaybeRefOrGetter<DocId[]>,
  configName?: string
) {
  const creditConfigOf = useDamCreditConfig(configName)
  const pick = (ids: DocId[]) =>
    ids.map((id) => getCached(id)).filter((item): item is DamCreditName => !isUndefined(item))
  return computed(() =>
    damCredit(pick(toValue(sourceIds)), pick(toValue(authorIds)), creditConfigOf(toValue(extSystem)))
  )
}

export async function fetchDamAuthorsMap(
  client: () => AxiosInstance,
  endPointAuthor: string,
  extSystem: IntegerId,
  ids: DocId[]
): Promise<Map<DocId, DamAuthor>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const authors = await fetchAuthorListByIds(client, endPointAuthor, extSystem, unique)
  return new Map(authors.map((author) => [author.id, author]))
}

/** Credit of the sources and authors, with names read from the DAM under `extSystem` and the format `config`. */
export async function fetchDamCredit(
  client: () => AxiosInstance,
  endPointAuthor: string,
  extSystem: IntegerId,
  sourceIds: DocId[] | undefined,
  authorIds: DocId[] | undefined,
  config: DamCreditConfig
): Promise<string> {
  if (hasNoDamCredit(authorIds, sourceIds)) return ''
  const authorsMap = await fetchDamAuthorsMap(client, endPointAuthor, extSystem, [
    ...(sourceIds ?? []),
    ...(authorIds ?? []),
  ])
  return damCreditFromMap(authorsMap, sourceIds, authorIds, config)
}
