import type { IntegerId } from '@/types/common'
import type { DamAssetListViewResolved } from '@/types/coreDam/AssetListView'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import { defineAuth } from '@/composables/auth/defineAuth'
import type { AclValue } from '@/types/Permission'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export const AssetSelectPresetAll = 'all' as const

export type AssetSelectPresetKey = string

export type AssetSelectPresetGroup = 'listView' | 'licence'

export interface AssetSelectPreset {
  key: AssetSelectPresetKey
  title: string
  licenceIds: IntegerId[]
  group: AssetSelectPresetGroup
}

export const showAssetSelectPresets = (
  selectLicences: IntegerId[],
  listViews: IntegerId[],
): boolean => selectLicences.length > 1 || listViews.length > 0

export const assetSelectSingleLicenceKey = (licenceId: IntegerId): AssetSelectPresetKey =>
  `licence:${licenceId}`

export interface AssetSelectPresetStoredState {
  presetKey: AssetSelectPresetKey
}

export function useAssetSelectPresets(storageKey: string) {
  const { useCurrentUser } = defineAuth<AclValue>(SYSTEM_DAM)
  const { currentUser: damCurrentUser } = useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)

  const buildPresets = (
    selectLicences: IntegerId[],
    listViews: IntegerId[],
    licenceTitle: (licenceId: IntegerId) => string,
  ): AssetSelectPreset[] => {
    const selectLicencesSet = new Set(selectLicences)
    const allowedListViewIds = new Set(listViews)
    const userListViews: DamAssetListViewResolved[] = damCurrentUser.value?.listViews ?? []

    const listViewPresets: AssetSelectPreset[] = userListViews
      .filter((listView) => allowedListViewIds.has(listView.id))
      .map((listView) => ({
        key: `listView:${listView.id}`,
        title: listView.name,
        licenceIds: listView.licences.filter((id) => selectLicencesSet.has(id)),
        group: 'listView' as const,
      }))
      .filter((preset) => preset.licenceIds.length > 0)

    return [
      ...listViewPresets,
      {
        key: AssetSelectPresetAll,
        title: t('common.assetSelect.preset.all'),
        licenceIds: selectLicences,
        group: 'licence' as const,
      },
      ...selectLicences.map((licenceId) => ({
        key: assetSelectSingleLicenceKey(licenceId),
        title: licenceTitle(licenceId),
        licenceIds: [licenceId],
        group: 'licence' as const,
      })),
    ]
  }

  const loadStoredState = (): AssetSelectPresetStoredState | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      return JSON.parse(raw) as AssetSelectPresetStoredState
    } catch {
      return null
    }
  }

  const storeState = (state: AssetSelectPresetStoredState): void => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // localStorage can be unavailable (private mode, blocked site data) — the preset just won't persist.
    }
  }

  return {
    buildPresets,
    loadStoredState,
    storeState,
  }
}

// Common-admin has no notion of a site group, so the sorted host ids stand in for it.
export function assetSelectPresetStorageKey(
  selectLicences: IntegerId[],
  listViews: IntegerId[],
): string {
  const licencesPart = [...selectLicences].sort((a, b) => a - b).join('-')
  const listViewsPart = [...listViews].sort((a, b) => a - b).join('-')
  return `common.assetSelect.preset.${licencesPart}.${listViewsPart}`
}
