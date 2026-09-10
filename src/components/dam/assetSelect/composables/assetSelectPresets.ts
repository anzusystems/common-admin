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

export const assetSelectSingleLicenceKey = (licenceId: IntegerId): AssetSelectPresetKey =>
  `licence:${licenceId}`

/**
 * Only the chosen selection is remembered, never an ad-hoc narrowing of its licences. Narrowing is a
 * temporary tweak, and carrying it into the next session silently searches a subset the editor no longer
 * sees a reason for — it reads as "licences are missing" rather than as a filter they once set.
 */
export interface AssetSelectPresetStoredState {
  presetKey: AssetSelectPresetKey
}

/**
 * One control carries every way of scoping the search, because a chip row next to a licence dropdown only
 * says the same thing twice. The list is grouped: the pinned `AssetListView`s first, then the site group's
 * own licences — all of them at once, and each one on its own, so reaching a single licence is one click
 * like it used to be. A view's licences are always intersected with `selectLicences`, so a view can narrow
 * the set the host allows but never widen it.
 */
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

/**
 * Q29: the preset choice is remembered per host configuration, not per component instance. Common-admin has
 * no notion of "site group", so the sorted `selectLicences`/`listViews` ids stand in as a stable proxy for it.
 */
export function useAssetSelectPresetStorageKey(
  selectLicences: IntegerId[],
  listViews: IntegerId[],
): string {
  const licencesPart = [...selectLicences].sort((a, b) => a - b).join('-')
  const listViewsPart = [...listViews].sort((a, b) => a - b).join('-')
  return `common.assetSelect.preset.${licencesPart}.${listViewsPart}`
}
