import { isUndefined } from '@/shared/utils/common'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import { damCreditConfigOf, damCreditFromMap, fetchDamAuthorsMap } from '@/domains/dam/author/composables/damCredit'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'

export function useImageMassOperations(configName: string) {
  const imageStore = useImageStore()

  const replaceEmptyDescription = (value: string, forceReplace = false) => {
    if (imageStore.readonly) return
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.texts.description) || item.texts.description.length === 0) {
        item.texts.description = value
      }
    }
  }

  const replaceEmptySource = (value: string, forceReplace = false) => {
    if (imageStore.readonly) return
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.texts.source) || item.texts.source.length === 0) {
        item.texts.source = value
        // The source is user-given text, not names from an author pick.
        imageStore.forgetSourceOfPick(item)
      }
    }
  }

  const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
  const { cachedExtSystemId } = useExtSystemIdForCached(configName)
  const damConfigStore = useDamConfigStoreOf(configName)
  const { getDamConfigExtSystem } = useDamConfigState(undefined, configName)

  type DamSelectionField = 'damAuthors' | 'damSources'
  type DamSelectionPicks = Partial<Record<DamSelectionField, DocId[]>>

  /**
   * Fills the sources or authors of the rows, or both, and a row's source with the credit of its sources and authors.
   * Each field is decided on a row as it was before the fill, so both at once fill the rows either alone would.
   * Names and format under the ext system of each row's asset licence, as everywhere else in the widgets.
   * Falls back to the configured ext system when the licence is unknown (or, for the format, not loaded).
   * One lookup per ext system; the fallback was previously used for every row.
   */
  const replaceEmptySelections = async (picks: DamSelectionPicks, forceReplace = false) => {
    if (imageStore.readonly) return
    // Empty picks fill nothing. Writing them would only clear the rows' sources.
    const fields = (Object.keys(picks) as DamSelectionField[]).filter(
      (field) => forceReplace || picks[field]!.length > 0
    )
    if (fields.length === 0) return
    const pageExtSystem = cachedExtSystemId.value
    const extSystemOf = (item: ImageStoreItem) =>
      damConfigStore.damConfigLicenceExtSystem.get(item.dam.licenceId)?.extSystem ?? pageExtSystem
    const fieldsTakenBy = (item: ImageStoreItem) => {
      // Whitespace counts as empty, as in the required-source check.
      const noSource = isUndefined(item.texts.source) || item.texts.source.trim().length === 0
      // A row not offering the pick shows its source. A filled source is the user's and is not overwritten.
      return fields.filter(
        (field) =>
          forceReplace || ((isUndefined(item[field]) || item[field].length === 0) && (item.showDamAuthors || noSource))
      )
    }
    // The fields a row takes and its ext system, as they were before the names loaded.
    const taken = new Map<ImageStoreItem, { fields: DamSelectionField[]; extSystem: IntegerId }>()
    const idsUnder = new Map<IntegerId, DocId[]>()
    imageStore.images.forEach((item) => {
      const itemFields = fieldsTakenBy(item)
      if (itemFields.length === 0) return
      const extSystem = extSystemOf(item)
      taken.set(item, { fields: itemFields, extSystem })
      idsUnder.set(extSystem, [
        ...(idsUnder.get(extSystem) ?? []),
        ...(item.damSources ?? []),
        ...(item.damAuthors ?? []),
        ...itemFields.flatMap((field) => picks[field]!),
      ])
    })
    const namesUnder = new Map<IntegerId, Map<DocId, DamAuthor>>()
    await Promise.all(
      [...idsUnder].map(async ([extSystem, ids]) => {
        namesUnder.set(extSystem, await fetchDamAuthorsMap(damClient, endPointAuthor, extSystem, ids))
      })
    )
    // The widget may have turned read-only while the names loaded.
    if (imageStore.readonly) return
    imageStore.images.forEach((item) => {
      // Only rows and fields that took the pick before and still do. A source typed meanwhile stays.
      const before = taken.get(item)
      if (isUndefined(before)) return
      const itemFields = fieldsTakenBy(item).filter((field) => before.fields.includes(field))
      const names = namesUnder.get(before.extSystem)
      if (itemFields.length === 0 || isUndefined(names)) return
      itemFields.forEach((field) => {
        item[field] = [...picks[field]!]
      })
      const extSystem = before.extSystem
      item.texts.source = damCreditFromMap(
        names,
        item.damSources,
        item.damAuthors,
        damCreditConfigOf(getDamConfigExtSystem(extSystem) ?? getDamConfigExtSystem(pageExtSystem))
      )
      imageStore.noteSourceOfPick(item)
    })
  }

  const replaceEmptyAuthors = (value: DocId[], forceReplace = false) =>
    replaceEmptySelections({ damAuthors: value }, forceReplace)

  const replaceEmptySources = (value: DocId[], forceReplace = false) =>
    replaceEmptySelections({ damSources: value }, forceReplace)

  return {
    replaceEmptyDescription,
    replaceEmptySource,
    replaceEmptyAuthors,
    replaceEmptySources,
    replaceEmptySelections,
  }
}
