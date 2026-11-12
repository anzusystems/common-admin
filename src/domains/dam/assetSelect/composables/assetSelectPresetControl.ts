import { computed, onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/shared/types/common'
import {
  type AssetSelectPreset,
  type AssetSelectPresetKey,
  assetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/domains/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'

/** The remembered preset if it is still offered, else the first licence. */
export const resolveInitialPresetKey = (
  presets: AssetSelectPreset[],
  storedPresetKey: AssetSelectPresetKey
): AssetSelectPresetKey | undefined => {
  const storedPreset = presets.find((preset) => preset.key === storedPresetKey)
  if (storedPreset) return storedPreset.key
  return presets.find((preset) => preset.group === 'licence')?.key
}

/**
 * The "Search in" choice of an asset select: list views of the host (`listViews`) and its licences. Call it in the setup
 * of a part that mounts after the select put the licences into the store. On mount it applies the remembered choice of
 * the DAM user, else the first licence, and so sets the licences the list is read from.
 * `showPresets` is the one place that decides whether the choice is shown.
 */
export function useAssetSelectPresetControl(listViews: IntegerId[], configName: string) {
  const { t } = useI18n()
  const { buildPresets, damCurrentUser } = useAssetSelectPresets(configName)
  const assetSelectStore = useAssetSelectStore()
  const { selectedPresetKey } = storeToRefs(assetSelectStore)
  // The select puts only the licences the user may read into the store before its content mounts.
  // DAM refuses the whole search when even one requested licence is unreadable.
  const selectLicences = assetSelectStore.selectConfig.map((config) => config.licence)
  // Without a DAM user there is nobody to remember the choice for.
  const damUserId = damCurrentUser.value?.id
  const storedPresetKey = damUserId
    ? useStorage<AssetSelectPresetKey>(
        assetSelectPresetStorageKey(damUserId, selectLicences, listViews, configName),
        '',
        localStorage,
        { writeDefaults: false }
      )
    : ref<AssetSelectPresetKey>('')

  const presets = computed(() => buildPresets(selectLicences, listViews, assetSelectStore.licenceTitle))
  const showPresets = computed(() => presets.value.length > 1)

  const items = computed(() => {
    const listViewPresets = presets.value.filter((preset) => preset.group === 'listView')
    const licencePresets = presets.value.filter((preset) => preset.group === 'licence')
    const asItem = (preset: AssetSelectPreset) => ({
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
