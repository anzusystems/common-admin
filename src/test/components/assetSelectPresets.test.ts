import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineAuth } from '@/composables/auth/defineAuth'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import {
  AssetSelectPresetAll,
  useAssetSelectPresets,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'

const setDamCurrentUser = (listViews: DamCurrentUserDto['listViews']) => {
  const { useCurrentUser } = defineAuth(SYSTEM_DAM)
  const { setCurrentUser } = useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)
  setCurrentUser({ id: 1, roles: [], listViews } as unknown as DamCurrentUserDto)
}

describe('useAssetSelectPresets.buildPresets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // R15: presets must be built from the licences the caller passes in (the allowed universe, once
  // AAssetSelect filters it) - never a wider list picked up from somewhere else.
  it('builds only from the given subset of licences, not a wider one', () => {
    setDamCurrentUser([])
    const { buildPresets } = useAssetSelectPresets('test-storage-key')

    const presets = buildPresets([10, 20], [], (id) => `Licence ${id}`)

    const all = presets.find((preset) => preset.key === AssetSelectPresetAll)
    expect(all?.licenceIds).toEqual([10, 20])
    expect(presets.map((preset) => preset.licenceIds).flat()).not.toContain(30)
  })

  it('intersects a list view licences with the given subset', () => {
    setDamCurrentUser([{ id: 1, name: 'View', extSystem: 1, licences: [10, 30] }])
    const { buildPresets } = useAssetSelectPresets('test-storage-key')

    const presets = buildPresets([10, 20], [1], (id) => `Licence ${id}`)

    const listViewPreset = presets.find((preset) => preset.key === 'listView:1')
    expect(listViewPreset?.licenceIds).toEqual([10])
  })

  it('drops a list view entirely when none of its licences are in the given subset', () => {
    setDamCurrentUser([{ id: 1, name: 'View', extSystem: 1, licences: [30] }])
    const { buildPresets } = useAssetSelectPresets('test-storage-key')

    const presets = buildPresets([10, 20], [1], (id) => `Licence ${id}`)

    expect(presets.find((preset) => preset.key === 'listView:1')).toBeUndefined()
  })
})
