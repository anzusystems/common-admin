import { computed, onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/types/common'
import {
  assetSelectSingleLicenceKey,
  type AssetSelectPresetKey,
  assetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'

export function useAssetSelectPresetControl(selectLicences: IntegerId[], listViews: IntegerId[]) {
  const { t } = useI18n()
  const { buildPresets, damCurrentUser } = useAssetSelectPresets()
  // Without a DAM user there is nobody to remember the choice for.
  const damUserId = damCurrentUser.value?.id
  const storedPresetKey = damUserId
    ? useStorage<AssetSelectPresetKey>(
        assetSelectPresetStorageKey(damUserId, selectLicences, listViews),
        '',
        localStorage,
        { writeDefaults: false },
      )
    : ref<AssetSelectPresetKey>('')

  const assetSelectStore = useAssetSelectStore()
  const { selectedLicenceIds, selectedPresetKey } = storeToRefs(assetSelectStore)

  const licenceTitle = (licenceId: IntegerId) => {
    return (
      assetSelectStore.selectConfig.find((config) => config.licence === licenceId)?.licenceName ||
      String(licenceId)
    )
  }

  const presets = computed(() => buildPresets(selectLicences, listViews, licenceTitle))

  const items = computed(() => {
    const listViewPresets = presets.value.filter((preset) => preset.group === 'listView')
    const licencePresets = presets.value.filter((preset) => preset.group === 'licence')
    const asItem = (preset: (typeof presets.value)[number]) => ({
      value: preset.key,
      title: preset.title,
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
    storedPresetKey.value = preset.key
  }

  onMounted(() => {
    if (selectedPresetKey.value !== '') return

    const storedPreset = presets.value.find((item) => item.key === storedPresetKey.value)

    applyPreset(storedPreset?.key ?? assetSelectSingleLicenceKey(selectLicences[0]))
  })

  return {
    items,
    selectedPresetKey,
    selectedLicenceIds,
    applyPreset,
    licenceTitle,
  }
}
