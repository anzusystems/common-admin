import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { useAssetSelectTakeOver } from '@/components/dam/assetSelect/composables/assetSelectTakeOver'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { IntegerId } from '@/types/common'

const UPLOAD_LICENCE = 1
const ALLOWED_LICENCE = 2
const DIRECT_USE_DISABLED_LICENCE = 3

const asset = (id: string, licence: IntegerId) =>
  ({ id, licence }) as unknown as AssetSearchListItemDto

let pinia: Pinia

const setup = (
  selectedLicences: IntegerId[],
  options: { uploadLicence?: IntegerId; isImage?: boolean } = {},
) => {
  let takeOver!: ReturnType<typeof useAssetSelectTakeOver>
  let store!: ReturnType<typeof useAssetSelectStore>
  mount(
    defineComponent({
      setup() {
        store = useAssetSelectStore()
        takeOver = useAssetSelectTakeOver({
          uploadLicence: () => ('uploadLicence' in options ? options.uploadLicence : UPLOAD_LICENCE),
          isImage: () => options.isImage ?? true,
        })
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } },
  )
  store.setMaxCount(10)
  store.setList(selectedLicences.map((licence, index) => asset(`asset-${index}`, licence)))
  selectedLicences.forEach((_licence, index) => store.toggleSelectedByIndex(index))
  return takeOver
}

describe('useAssetSelectTakeOver', () => {
  beforeEach(() => {
    pinia = createPinia()
    const { addManualToCachedAssetLicences } = useDamCachedAssetLicences()
    addManualToCachedAssetLicences({
      id: ALLOWED_LICENCE,
      name: 'Allowed',
      badge: 'A',
      flags: { directUseAllowed: true },
    } as DamAssetLicence)
    addManualToCachedAssetLicences({
      id: DIRECT_USE_DISABLED_LICENCE,
      name: 'Agency',
      badge: 'AG',
      flags: { directUseAllowed: false },
    } as DamAssetLicence)
  })

  it('offers no take over when everything selected is in the upload licence', () => {
    const takeOver = setup([UPLOAD_LICENCE])

    expect(takeOver.showTakeOver.value).toBe(false)
    expect(takeOver.getForceTakeOver()).toBe(false)
  })

  it.each([
    ['there is no upload licence', { uploadLicence: undefined }],
    ['the record is not an image', { isImage: false }],
  ])('offers no take over when %s', (_name, options) => {
    const takeOver = setup([ALLOWED_LICENCE], options)

    expect(takeOver.showTakeOver.value).toBe(false)
    expect(takeOver.getForceTakeOver()).toBe(false)
  })

  it('lets the user choose the take over of a photo from another licence', () => {
    const takeOver = setup([ALLOWED_LICENCE])

    expect(takeOver.showTakeOver.value).toBe(true)
    expect(takeOver.takeOverLocked.value).toBe(false)
    expect(takeOver.getForceTakeOver()).toBe(false)

    takeOver.takeOverModel.value = true

    expect(takeOver.getForceTakeOver()).toBe(true)
  })

  it('locks the take over on when the licence does not allow direct use', () => {
    const takeOver = setup([DIRECT_USE_DISABLED_LICENCE])

    expect(takeOver.takeOverLocked.value).toBe(true)
    expect(takeOver.takeOverModel.value).toBe(true)

    takeOver.takeOverModel.value = false

    expect(takeOver.takeOverModel.value).toBe(true)
    expect(takeOver.getForceTakeOver()).toBe(true)
  })
})
