import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
// eslint-disable-next-line no-restricted-imports -- this test is about the public entry itself
import * as lib from '@/lib'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'

// What admin-cms and admin-ugc import from the library to show and upload images of the DAM. The upload is being
// unified with the one of admin-dam: whatever moves inside, these names stay where the two applications find them,
// and the configuration store keeps the members admin-ugc writes straight into.

describe('what the two applications import for their DAM images', () => {
  it.each([
    'AImageWidget',
    'AImageWidgetInner',
    'AImageWidgetMultiple',
    'AImageWidgetMultipleInner',
    'AImageWidgetSimple',
    'AImageWidgetMultipleSimple',
    'AImageMediaWidget',
    'AMediaWidgetSimple',
    'AImageMassOperations',
    'AImagePublicInput',
    'AAssetSelect',
    'AAssetListInner',
    'AFileInput',
    'ADamAdminAssetLink',
  ])('the component %s', (name) => {
    const component = (lib as Record<string, unknown>)[name] as { setup?: unknown; render?: unknown } | undefined

    expect(component).toBeTypeOf('object')
    expect(typeof component!.setup === 'function' || typeof component!.render === 'function').toBe(true)
  })

  it.each([
    'useDamConfigStore',
    'useDamConfigState',
    'useImageStore',
    'useImageActions',
    'useCommonAdminImageOptions',
    'initDamNotifications',
    'useDropzoneGlobalDragState',
    'isImageCreateUpdateAware',
    'isMediaAware',
    'fetchAsset',
    'fetchAssetByFileId',
    'fetchAssetAsCmsMedia',
    'fetchAssetAndCheckForSingleUseByFileIds',
    'assetFileIsImageFile',
  ])('the function %s', (name) => {
    expect((lib as Record<string, unknown>)[name]).toBeTypeOf('function')
  })

  it('the kinds of an asset, and the key the upload configuration is provided under', () => {
    expect(lib.DamAssetType).toBe(DamAssetType)
    expect(lib.DamAssetType).toMatchObject({ Image: 'image', Audio: 'audio', Video: 'video', Document: 'document' })
    expect(lib.ImageWidgetUploadConfigKey).toBeTypeOf('symbol')
  })

  // The names an application mounts are those of the library's own widgets, not of copies made beside them.
  it('are the widgets of the library themselves, the inner ones under the names with an A', () => {
    expect(lib.AImageWidget).toBe(AImageWidget)
    expect(lib.AImageWidgetInner).toBe(ImageWidgetInner)
    expect(lib.AImageWidgetMultiple).toBe(AImageWidgetMultiple)
    expect(lib.AImageWidgetMultipleInner).toBe(ImageWidgetMultipleInner)
    expect(lib.AImageMediaWidget).toBe(AImageMediaWidget)
    expect(lib.AAssetSelect).toBe(AAssetSelect)
    expect(lib.AAssetListInner).toBe(AAssetListInner)
  })
})

// admin-ugc loads no configuration through the library: before it mounts an inner widget it writes the
// configuration of its blog straight into the store. A member renamed here breaks its three wrappers at run time,
// with no type error on the side of the library.
describe('the DAM configuration store, as admin-ugc writes it', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has the two flags, the chunk limits of the settings, and the three maps under their names', () => {
    const store = lib.useDamConfigStore()

    expect(store.initialized).toEqual({ damPubConfig: false, damPrvConfig: false })
    expect(store.damPrvConfig.settings.imageChunkConfig).toEqual({ minSize: 0, maxSize: 0 })
    expect(store.damConfigLicenceExtSystem).toBeInstanceOf(Map)
    expect(store.damConfigAssetCustomFormElements).toBeInstanceOf(Map)
    expect(store.damConfigExtSystem).toBeInstanceOf(Map)
  })

  it('answers the library with what was written into it', () => {
    const store = lib.useDamConfigStore()
    const extSystemConfig = { image: { enabled: true, mimeTypes: ['image/jpeg'], sizeLimit: 1 } } as never
    const elements = { image: [], audio: [], video: [], document: [] }

    store.damPrvConfig.settings.imageChunkConfig = { minSize: 1048576, maxSize: 52428800 }
    store.initialized.damPrvConfig = true
    store.damConfigLicenceExtSystem.set(200004, { name: '', extSystem: 4 })
    store.damConfigAssetCustomFormElements.set(4, elements)
    store.damConfigExtSystem.set(4, extSystemConfig)

    const state = lib.useDamConfigState()
    expect(state.isDamPrvConfigLoaded()).toBe(true)
    expect(state.getDamConfigExtSystem(4)).toBe(extSystemConfig)
    expect(state.getDamConfigAssetCustomFormElements(4)).toBe(elements)
    expect(lib.useDamConfigStore().damPrvConfig.settings.imageChunkConfig).toEqual({
      minSize: 1048576,
      maxSize: 52428800,
    })
    expect(lib.useDamConfigStore().damConfigLicenceExtSystem.get(200004)).toEqual({ name: '', extSystem: 4 })
  })
})
