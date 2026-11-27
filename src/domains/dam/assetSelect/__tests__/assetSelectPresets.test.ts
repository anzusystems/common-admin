import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import {
  assetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/domains/dam/assetSelect/composables/assetSelectPresets'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import type { IntegerId } from '@/shared/types/common'

const options = vi.hoisted(() => ({ currentUser: 'dam' as string | false }))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ currentUser: options.currentUser }),
}))

const setDamCurrentUser = (listViews: DamCurrentUserDto['listViews'], system = SYSTEM_DAM) => {
  const { useCurrentUser } = defineAuth(system)
  const { setCurrentUser } = useCurrentUser<DamCurrentUserDto>(system)
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
    options.currentUser = SYSTEM_DAM
  })
  afterEach(() => {
    useAuthStore().reset()
  })

  it('offers each licence on its own, never a wider set', () => {
    setDamCurrentUser([])
    const { buildPresets } = useAssetSelectPresets('default')

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
    const { buildPresets } = useAssetSelectPresets('default')

    const presets = buildPresets([10, 20], pinnedListViews, (id) => `Licencia ${id}`)

    expect(presets.find((preset) => preset.key === 'listView:1')?.licenceIds).toEqual(expected)
  })

  it('takes the list views of the user of the system the configuration names', () => {
    options.currentUser = 'cms'
    setDamCurrentUser([sportListView([10])], 'cms')
    const { buildPresets } = useAssetSelectPresets('default')

    expect(buildPresets([10], [1], String).map(({ key }) => key)).toEqual(['listView:1', 'licence:10'])
  })

  it('offers only the licences where the configuration decides by no user', () => {
    options.currentUser = false
    setDamCurrentUser([sportListView([10])])
    const { buildPresets } = useAssetSelectPresets('default')

    expect(buildPresets([10], [1], String).map(({ key }) => key)).toEqual(['licence:10'])
  })

  it('offers only the licences for a user of a DAM without list views', () => {
    setDamCurrentUser(undefined as unknown as DamCurrentUserDto['listViews'])
    const { buildPresets } = useAssetSelectPresets('default')

    expect(buildPresets([10], [1], String).map(({ key }) => key)).toEqual(['licence:10'])
  })

  it('keys the remembered preset by DAM user and host configuration, whatever the order of its ids', () => {
    expect(assetSelectPresetStorageKey(1, [20, 10], [2, 1])).toBe(assetSelectPresetStorageKey(1, [10, 20], [1, 2]))
    expect(assetSelectPresetStorageKey(2, [10, 20], [1, 2])).not.toBe(assetSelectPresetStorageKey(1, [10, 20], [1, 2]))
    expect(assetSelectPresetStorageKey(1, [10, 20], [1])).not.toBe(assetSelectPresetStorageKey(1, [10, 20], [1, 2]))
  })

  it('keeps the key of 1.50.0 for the default configuration and adds the name of another', () => {
    expect(assetSelectPresetStorageKey(1, [10, 20], [1])).toBe('common.assetSelect.preset.1.10-20.1')
    expect(assetSelectPresetStorageKey(1, [10, 20], [1], 'default')).toBe('common.assetSelect.preset.1.10-20.1')
    expect(assetSelectPresetStorageKey(1, [10, 20], [1], 'own')).toBe('common.assetSelect.preset.own.1.10-20.1')
  })
})
