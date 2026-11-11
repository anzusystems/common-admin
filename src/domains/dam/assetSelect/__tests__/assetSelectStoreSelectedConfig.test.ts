import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'

// The image widgets read the picked licence's ext system through `requireSelectedSelectConfig()` after an
// asset was picked. They read `selectedSelectConfig.extSystem`, and with no config failed with a TypeError.

const config = (licence: number, extSystem: number) =>
  ({ licence, extSystem, licenceName: '', extSystemConfig: {} }) as unknown as DamConfigLicenceExtSystemReturnType

describe('assetSelectStore requireSelectedSelectConfig', () => {
  it('is the config of the first selected licence, or the first one', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setSelectConfig([config(1, 10), config(2, 20)])
    expect(store.selectedLicenceIds).toEqual([])
    expect(store.requireSelectedSelectConfig().extSystem).toBe(10)
    store.setSelectedLicenceIds([2])
    expect(store.requireSelectedSelectConfig().extSystem).toBe(20)
    store.setSelectedLicenceIds([2, 1])
    expect(store.requireSelectedSelectConfig().extSystem).toBe(20)
    store.setSelectedLicenceIds([3])
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

describe('assetSelectStore selected licences', () => {
  it('keeps the licences when the same ones come again, so the list does not reload', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setSelectedLicenceIds([10, 20])
    const selected = store.selectedLicenceIds

    store.setSelectedLicenceIds([20, 10])

    expect(store.selectedLicenceIds).toBe(selected)
  })

  it('names a licence by its config, else by its id', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setSelectConfig([{ ...config(1, 10), licenceName: 'Sme' }])

    expect(store.licenceTitle(1)).toBe('Sme')
    expect(store.licenceTitle(9)).toBe('9')
  })

  it('forgets the chosen licences and preset on a full reset', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setSelectedLicenceIds([1])
    store.setSelectedPresetKey('licence:1')

    store.reset(true)

    expect(store.selectedLicenceIds).toEqual([])
    expect(store.selectedPresetKey).toBe('')
  })
})
