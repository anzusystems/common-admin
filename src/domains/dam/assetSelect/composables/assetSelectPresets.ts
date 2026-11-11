import type { IntegerId } from '@/shared/types/common'
import type { DamAssetListViewResolved } from '@/domains/dam/types/AssetListView'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import type { AclValue } from '@/domains/auth/types/Permission'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { computed } from 'vue'

export type AssetSelectPresetKey = string

type AssetSelectPresetGroup = 'listView' | 'licence'

export interface AssetSelectPreset {
  key: AssetSelectPresetKey
  title: string
  licenceIds: IntegerId[]
  group: AssetSelectPresetGroup
}

export const assetSelectSingleLicenceKey = (licenceId: IntegerId): AssetSelectPresetKey => `licence:${licenceId}`

/**
 * The presets of an asset select: the host's list views the DAM user has, each narrowed to the host's licences (one
 * without a common licence is left out), then each host licence on its own.
 * The DAM user is the current user of the system `currentUser` of the configuration `configName`. Without one
 * (`currentUser: false`, nobody logged in) only the licences are offered.
 */
export function useAssetSelectPresets(configName: string) {
  const { currentUser: system } = useCommonAdminCoreDamOptions(configName)
  const currentUser =
    system === false ? undefined : defineAuth<AclValue>(system).useCurrentUser<DamCurrentUserDto>(system).currentUser
  const damCurrentUser = computed<DamCurrentUserDto | undefined>(() => currentUser?.value)

  const buildPresets = (
    selectLicences: IntegerId[],
    listViews: IntegerId[],
    licenceTitle: (licenceId: IntegerId) => string
  ): AssetSelectPreset[] => {
    const selectLicencesSet = new Set(selectLicences)
    const allowedListViewIds = new Set(listViews)
    // A DAM before list views sends none.
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
      ...selectLicences.map((licenceId) => ({
        key: assetSelectSingleLicenceKey(licenceId),
        title: licenceTitle(licenceId),
        licenceIds: [licenceId],
        group: 'licence' as const,
      })),
    ]
  }

  return {
    buildPresets,
    damCurrentUser,
  }
}

/**
 * Key of the remembered preset. Common-admin has no notion of a site group, so the sorted host ids stand in for it: a
 * changed site group configuration gets a new key. The DAM user is part of the key, so the next user in the same browser
 * starts fresh. A named DAM configuration adds its name; `default` keeps the key of 1.50.0.
 */
export function assetSelectPresetStorageKey(
  damUserId: IntegerId,
  selectLicences: IntegerId[],
  listViews: IntegerId[],
  configName = 'default'
): string {
  const licencesPart = [...selectLicences].sort((a, b) => a - b).join('-')
  const listViewsPart = [...listViews].sort((a, b) => a - b).join('-')
  const configPart = configName === 'default' ? '' : `${configName}.`
  return `common.assetSelect.preset.${configPart}${damUserId}.${licencesPart}.${listViewsPart}`
}
