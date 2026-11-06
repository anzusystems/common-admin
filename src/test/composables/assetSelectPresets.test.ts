import { beforeEach, describe, expect, it } from 'vitest'
import { defineAuth } from '@/composables/auth/defineAuth'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import {
  showAssetSelectPresets,
  useAssetSelectPresets,
  assetSelectPresetStorageKey,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import type { IntegerId } from '@/types/common'

const setDamCurrentUser = (listViews: DamCurrentUserDto['listViews']) => {
  const { useCurrentUser } = defineAuth(SYSTEM_DAM)
  const { setCurrentUser } = useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)
  setCurrentUser({ id: 1, roles: [], listViews } as unknown as DamCurrentUserDto)
}

const sportListView = (licences: IntegerId[]) => ({
  id: 1,
  name: 'Šport a regióny',
  extSystem: 1,
  licences,
  uploadLicence: null,
})

describe('useAssetSelectPresets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('offers each licence on its own, never a wider set', () => {
    setDamCurrentUser([])
    const { buildPresets } = useAssetSelectPresets('test-storage-key')

    const presets = buildPresets([10, 20], [], (id) => `Licencia ${id}`)

    expect(presets.map(({ key, licenceIds }) => ({ key, licenceIds }))).toEqual([
      { key: 'licence:10', licenceIds: [10] },
      { key: 'licence:20', licenceIds: [20] },
    ])
  })

  it.each<[string, IntegerId[], IntegerId[], IntegerId[] | undefined]>([
    ['list view narrowed to the allowed licences', [10, 30], [1], [10]],
    ['list view with no allowed licence', [30], [1], undefined],
    ['list view not pinned for the host', [10, 20], [], undefined],
  ])('%s', (_name, listViewLicences, pinnedListViews, expected) => {
    setDamCurrentUser([sportListView(listViewLicences)])
    const { buildPresets } = useAssetSelectPresets('test-storage-key')

    const presets = buildPresets([10, 20], pinnedListViews, (id) => `Licencia ${id}`)

    expect(presets.find((preset) => preset.key === 'listView:1')?.licenceIds).toEqual(expected)
  })

  it('remembers the chosen preset per host configuration whatever the order of its ids', () => {
    setDamCurrentUser([])
    useAssetSelectPresets(assetSelectPresetStorageKey([20, 10], [2, 1])).storeState({
      presetKey: 'listView:1',
    })

    const { loadStoredState } = useAssetSelectPresets(assetSelectPresetStorageKey([10, 20], [1, 2]))

    expect(loadStoredState()).toEqual({ presetKey: 'listView:1' })
  })

  it('ignores a remembered value it cannot read', () => {
    setDamCurrentUser([])
    localStorage.setItem('test-storage-key', '{broken')

    expect(useAssetSelectPresets('test-storage-key').loadStoredState()).toBeNull()
  })
})

describe('showAssetSelectPresets', () => {
  it.each<[string, IntegerId[], IntegerId[], boolean]>([
    ['one licence and no list view', [10], [], false],
    ['no licence and no list view', [], [], false],
    ['two licences', [10, 20], [], true],
    ['one licence and a list view', [10], [1], true],
  ])('%s', (_name, selectLicences, listViews, expected) => {
    expect(showAssetSelectPresets(selectLicences, listViews)).toBe(expected)
  })
})
