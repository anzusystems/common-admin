import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/types/common'
import {
  AssetSelectPresetAll,
  type AssetSelectPresetKey,
  useAssetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'

/**
 * Shared by the selection control in the filter sidebar and by the licence chips above the list: both need
 * the same options, the same active selection and the same "this no longer matches the selection" state, so
 * neither may own a copy of it.
 */
export function useAssetSelectPresetControl(selectLicences: IntegerId[], listViews: IntegerId[]) {
  const { t } = useI18n()
  const storageKey = useAssetSelectPresetStorageKey(selectLicences, listViews)
  const { buildPresets, loadStoredState, storeState } = useAssetSelectPresets(storageKey)
  const { addToCachedAssetLicences, fetchCachedAssetLicences, getCachedAssetLicence } =
    useDamCachedAssetLicences()

  const assetSelectStore = useAssetSelectStore()
  const { selectedLicenceIds, selectedPresetKey } = storeToRefs(assetSelectStore)

  const licenceTitle = (licenceId: IntegerId) => {
    return getCachedAssetLicence(licenceId)?.name || String(licenceId)
  }

  const licenceBadge = (licenceId: IntegerId) => getCachedAssetLicence(licenceId)?.badge ?? ''

  const presets = computed(() => buildPresets(selectLicences, listViews, licenceTitle))

  const activePreset = computed(() => {
    return presets.value.find((preset) => preset.key === selectedPresetKey.value)
  })

  /**
   * Picking a selection fills the licences but does not lock them: dropping one afterwards is the expected
   * way to work, so the selection is marked as changed instead of pretending it still describes the search.
   */
  const isModified = computed(() => {
    const presetIds = activePreset.value?.licenceIds ?? []
    if (presetIds.length !== selectedLicenceIds.value.length) return true

    return presetIds.some((id) => !selectedLicenceIds.value.includes(id))
  })

  const items = computed(() => {
    const listViewPresets = presets.value.filter((preset) => preset.group === 'listView')
    const licencePresets = presets.value.filter((preset) => preset.group === 'licence')
    const asItem = (preset: (typeof presets.value)[number]) => ({
      value: preset.key,
      title:
        preset.key === selectedPresetKey.value && isModified.value
          ? t('common.assetSelect.preset.modifiedTitle', { title: preset.title })
          : preset.title,
    })

    return [
      ...(listViewPresets.length > 0
        ? [
            { type: 'subheader' as const, title: t('common.assetSelect.preset.groupListViews') },
            ...listViewPresets.map(asItem),
          ]
        : []),
      { type: 'subheader' as const, title: t('common.assetSelect.preset.groupLicences') },
      ...licencePresets.map(asItem),
    ]
  })

  const applyPreset = (key: AssetSelectPresetKey) => {
    const preset = presets.value.find((item) => item.key === key)
    if (!preset) return

    assetSelectStore.setSelectedPresetKey(preset.key)
    assetSelectStore.setSelectedLicenceIds(preset.licenceIds)
    storeState({ presetKey: preset.key })
  }

  /**
   * The active key lives in the shared store, so it can come from another picker on the page with a
   * different `selectLicences` and be unknown here. Resolving it to "all licences" is the same fallback
   * the stored key gets on mount.
   */
  const resetToPreset = () => {
    const isKnownKey = presets.value.some((item) => item.key === selectedPresetKey.value)
    applyPreset(isKnownKey ? selectedPresetKey.value : AssetSelectPresetAll)
  }

  const isClearable = computed(() => selectedLicenceIds.value.length > 1)

  const removeLicence = (licenceId: IntegerId) => {
    if (!isClearable.value) return
    assetSelectStore.setSelectedLicenceIds(
      selectedLicenceIds.value.filter((id) => id !== licenceId),
    )
  }

  // Both callers run this; adding and fetching an already cached licence is a no-op.
  onMounted(async () => {
    addToCachedAssetLicences(selectLicences)
    await fetchCachedAssetLicences()

    if (selectedPresetKey.value !== '') return

    const stored = loadStoredState()
    const storedPreset = stored
      ? presets.value.find((item) => item.key === stored.presetKey)
      : undefined

    applyPreset(storedPreset?.key ?? AssetSelectPresetAll)
  })

  return {
    presets,
    items,
    selectedPresetKey,
    selectedLicenceIds,
    isModified,
    isClearable,
    applyPreset,
    resetToPreset,
    removeLicence,
    licenceTitle,
    licenceBadge,
  }
}
