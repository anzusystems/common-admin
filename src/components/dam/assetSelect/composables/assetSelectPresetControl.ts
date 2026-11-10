import { computed, onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/types/common'
import {
  type AssetSelectPreset,
  type AssetSelectPresetKey,
  assetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'

export const resolveInitialPresetKey = (
  presets: AssetSelectPreset[],
  storedPresetKey: AssetSelectPresetKey,
): AssetSelectPresetKey | undefined => {
  const storedPreset = presets.find((preset) => preset.key === storedPresetKey)
  if (storedPreset) return storedPreset.key
  return presets.find((preset) => preset.group === 'licence')?.key
}

export function useAssetSelectPresetControl(listViews: IntegerId[]) {
  const { t } = useI18n()
  const { buildPresets, damCurrentUser } = useAssetSelectPresets()
  const assetSelectStore = useAssetSelectStore()
  const { selectedPresetKey } = storeToRefs(assetSelectStore)
  // The picker puts only the licences the user may read into the store before its content mounts;
  // DAM refuses the whole search when even one requested licence is unreadable.
  const selectLicences = assetSelectStore.selectConfig.map((config) => config.licence)
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

  const presets = computed(() => buildPresets(selectLicences, listViews, assetSelectStore.licenceTitle))
  const showPresets = computed(() => presets.value.length > 1)

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

  const applyPreset = (key: AssetSelectPresetKey | undefined) => {
    const preset = presets.value.find((item) => item.key === key)
    if (!preset) return

    assetSelectStore.setSelectedPresetKey(preset.key)
    assetSelectStore.setSelectedLicenceIds(preset.licenceIds)
    storedPresetKey.value = preset.key
  }

  onMounted(() => {
    if (selectedPresetKey.value !== '') return
    applyPreset(resolveInitialPresetKey(presets.value, storedPresetKey.value))
  })

  return {
    items,
    showPresets,
    selectedPresetKey,
    applyPreset,
  }
}
