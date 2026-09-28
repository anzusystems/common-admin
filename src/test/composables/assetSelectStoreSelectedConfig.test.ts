import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'

// The image widgets read the picked licence's ext system through `requireSelectedSelectConfig()` after an
// asset was picked. They read `selectedSelectConfig.extSystem`, and with no config failed with a TypeError.

const config = (licence: number, extSystem: number) =>
  ({ licence, extSystem, licenceName: '', extSystemConfig: {} }) as unknown as DamConfigLicenceExtSystemReturnType

describe('assetSelectStore requireSelectedSelectConfig', () => {
  it('is the config of the selected licence, or the first one', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setSelectConfig([config(1, 10), config(2, 20)])
    expect(store.requireSelectedSelectConfig().extSystem).toBe(10)
    store.selectedLicenceId = 2
    expect(store.requireSelectedSelectConfig().extSystem).toBe(20)
    store.selectedLicenceId = 3
    expect(store.requireSelectedSelectConfig().extSystem).toBe(10)
  })

  it('says so when no licence config was set, while the getter stays readable', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    expect(() => store.requireSelectedSelectConfig()).toThrow(/no licence config selected/)
    expect(store.selectedSelectConfig).toBeUndefined()
    store.setSelectConfig([])
    expect(() => store.requireSelectedSelectConfig()).toThrow(/no licence config selected/)
  })
})
