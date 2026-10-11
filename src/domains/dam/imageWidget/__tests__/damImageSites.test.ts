import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import placeholder16x9 from '@/assets/image/placeholder16x9.svg'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import AImagePublicInput from '@/domains/dam/imageWidget/components/AImagePublicInput.vue'
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import { DamMediaType, type MediaAware } from '@/domains/dam/types/MediaAware'
import type { IntegerIdNullable } from '@/shared/types/common'

// Two places outside the widgets that make the image of the CMS for a file of the DAM by hand (IM7, IM8 and IM9 of
// the design), under each of the two applications: what the public input saves and what it previews, and the image
// the detail of a media shows. The real components; the DAM and the image API are clients that record their
// requests (admin-ugc brings its own image API, which records what it is handed).

// A file of the DAM is named by a UUID: the public input takes nothing else.
const FILE = '0f6b8f6a-5d2c-4c1e-9a7b-3e2d1c0b9a81'
const OTHER_FILE = '7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5'

let pinia: Pinia
let dam: FakeDam
let images: ConsumerImageApi
let wrapper: VueWrapper | undefined

describe.each(consumerProfiles)('the image of the CMS outside the widgets under the $name', (profile) => {
  const { endPoints, licence } = profile

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    images = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    forgetAlerts()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  // A licence of the same user, other than the one of the upload.
  const otherLicence = licence + 1

  /** The asset of the file, as the DAM answers it. */
  const damHas = (mainFileInternal: boolean | null, file = FILE, ofLicence = licence) =>
    dam.assets.set(
      `asset-of-${file}`,
      damAssetWithFile(`asset-of-${file}`, file, AssetFileProcessStatus.Processed, {
        licence: ofLicence,
        mainFileInternal,
      })
    )

  describe('the public input (IM8, IM9)', () => {
    /** The model of the dialog that holds the input. */
    let model: IntegerIdNullable = null
    // As the embed dialog of admin-cms uses it: a model of the image id, and `submit` when the dialog confirms.
    const mountInput = async (modelValue: IntegerIdNullable) => {
      model = modelValue
      wrapper = mount(AImagePublicInput, {
        attachTo: document.body,
        props: {
          modelValue,
          'onUpdate:modelValue': (value: IntegerIdNullable) => {
            model = value
            return wrapper!.setProps({ modelValue: value })
          },
          selectLicences: [licence, otherLicence],
        },
        global: { plugins: [pinia] },
      })
      await flushPromises()
    }
    const input = () => wrapper!.get<HTMLInputElement>('input[type="text"]')
    // A growing text field has a hidden twin that measures it.
    const texts = () => wrapper!.findAll('textarea').filter((field) => field.attributes('aria-hidden') !== 'true')
    const preview = () => wrapper!.find('img')
    const typeFile = async (value: string) => {
      await input().setValue(value)
      await input().trigger('blur')
      await flushPromises()
    }
    const submit = async () => {
      const done = (wrapper!.vm as unknown as { submit: () => Promise<unknown> }).submit()
      await flushPromises()
      return done
    }
    const saves = () => images.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')

    it('creates the image of the file with the texts trimmed, at position 0 and without an id', async () => {
      damHas(true)
      await mountInput(null)
      await typeFile(FILE)
      await texts()[0]!.setValue('  Harbour at dawn ')
      await texts()[1]!.setValue(' Jana  ')

      const done = (await submit()) as { image: ImageAware } | undefined

      expect(shownAlerts()).toEqual([])
      expect(saves()).toEqual([
        [
          'createImage',
          {
            texts: { description: 'Harbour at dawn', source: 'Jana' },
            flags: { showSource: true, internal: false, overrideInternal: false },
            dam: { damId: FILE, licenceId: licence, regionPosition: 0, internal: true },
            position: 0,
          },
        ],
      ])
      expect(model).toBe(done!.image.id)
      // The image it has just created is not read again (finding 36): the fields show what the create answered.
      expect(images.calls.map(([call]) => call)).toEqual(['createImage'])
      expect([input().element.value, ...texts().map((field) => (field.element as HTMLTextAreaElement).value)]).toEqual([
        FILE,
        'Harbour at dawn',
        'Jana',
      ])
    })

    // Only that once: an id the model is changed to afterwards is read, also the one of the image it created.
    it('reads the image its model is changed to after it created one, as before', async () => {
      damHas(true)
      damHas(false, OTHER_FILE)
      const other: ImageAware = {
        id: 803,
        texts: { description: 'Another image', source: 'Peter' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: OTHER_FILE, licenceId: licence, regionPosition: 0, internal: false },
        position: 0,
      }
      images.has(other)
      await mountInput(null)
      await typeFile(FILE)
      await texts()[0]!.setValue('Harbour at dawn')
      await texts()[1]!.setValue('Jana')
      const done = (await submit()) as { image: ImageAware }
      expect(images.calls.map(([call]) => call)).toEqual(['createImage'])

      await wrapper!.setProps({ modelValue: other.id })
      await flushPromises()
      expect(input().element.value).toBe(OTHER_FILE)
      await wrapper!.setProps({ modelValue: done.image.id })
      await flushPromises()

      expect(images.calls.slice(1)).toEqual([
        ['fetchImage', other.id],
        ['fetchImage', done.image.id],
      ])
      expect(input().element.value).toBe(FILE)
    })

    it('updates a saved image under its id', async () => {
      damHas(null)
      const saved: ImageAware = {
        id: 801,
        texts: { description: 'Old description', source: 'Peter' },
        flags: { showSource: false, internal: false, overrideInternal: false },
        dam: { damId: FILE, licenceId: licence, regionPosition: 2, internal: false },
        position: 3,
      }
      images.has(saved)
      await mountInput(saved.id)
      expect(input().element.value).toBe(FILE)

      await texts()[0]!.setValue('New description ')
      await submit()

      expect(shownAlerts()).toEqual([])
      expect(saves()).toEqual([
        [
          'updateImage',
          saved.id,
          {
            texts: { description: 'New description', source: 'Peter' },
            flags: { showSource: true, internal: false, overrideInternal: false },
            dam: { damId: FILE, licenceId: licence, regionPosition: 0, internal: false },
            position: 0,
            id: saved.id,
          },
        ],
      ])
    })

    // The file typed in place of the one of the image: what is saved is of the asset of that file, whose licence is
    // neither the first the input may pick from nor the one of the application.
    it('updates a saved image with the file typed in its place, of the licence of that file', async () => {
      damHas(true, OTHER_FILE)
      damHas(false, FILE, otherLicence)
      const saved: ImageAware = {
        id: 802,
        texts: { description: 'Old description', source: 'Peter' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: OTHER_FILE, licenceId: licence, regionPosition: 0, internal: true },
        position: 0,
      }
      images.has(saved)
      await mountInput(saved.id)
      expect(input().element.value).toBe(OTHER_FILE)

      await typeFile(FILE)
      await submit()

      expect(shownAlerts()).toEqual([])
      expect(saves()).toEqual([
        [
          'updateImage',
          saved.id,
          {
            texts: { description: 'Old description', source: 'Peter' },
            flags: { showSource: true, internal: false, overrideInternal: false },
            dam: { damId: FILE, licenceId: otherLicence, regionPosition: 0, internal: false },
            position: 0,
            id: saved.id,
          },
        ],
      ])
    })

    // The image it previews is the original of the file, whatever the licence or the region.
    it.each([
      ['its id', FILE],
      ['the address of its original', `https://image-original.test/image/original/${FILE}.jpg`],
    ])('previews the original of a file typed by %s', async (_what, typed) => {
      damHas(false)
      await mountInput(null)
      expect(preview().exists()).toBe(false)

      await typeFile(typed)

      expect(preview().attributes('src')).toBe(`https://image-original.test/image/original/${FILE}.jpg`)
      expect(images.calls).toEqual([])
    })
  })

  describe('the detail of a media (IM7)', () => {
    const media = (imageFileId: string | null): MediaAware => ({
      damMedia: {
        imageFileId,
        assetId: 'asset-1',
        licenceId: licence,
        assetType: DamMediaType.Video,
        title: 'Evening news',
        description: '',
        seriesName: '',
        authorNames: [],
        publishedAt: null,
        duration: 120,
        mediaUrl: null,
        playable: false,
        syncedWithDam: true,
        episodeName: '',
        episodeNumber: null,
      },
      extService: 'damVideo',
    })
    // As the image and media widget opens it.
    const mountDetail = async (detail: MediaAware) => {
      useImageMediaWidgetStore(pinia).setDetail(detail)
      wrapper = mount(ImageDetailDialogMetadata, {
        attachTo: document.body,
        props: { modelValue: true, saving: false, loading: false },
        global: { plugins: [pinia] },
      })
      await flushPromises()
    }
    const shown = () => wrapper!.findComponent(AImageWidgetSimple)

    it('shows the image of the file of the media without its source, from the licence of the media', async () => {
      await mountDetail(media(FILE))

      expect(shown().props('image')).toStrictEqual<ImageCreateUpdateAware>({
        texts: { description: '', source: '' },
        dam: { damId: FILE, licenceId: licence, regionPosition: 0, internal: false },
        flags: { showSource: false, internal: false, overrideInternal: false },
      })
      expect(shown().findComponent({ name: 'VImg' }).props('src')).toBe(
        `https://image.test/image/w500-h281/${FILE}.jpg`
      )
      expect(images.calls).toEqual([])
    })

    it('shows the placeholder for a media without the file of an image', async () => {
      await mountDetail(media(null))

      expect(shown().findComponent({ name: 'VImg' }).props('src')).toBe(placeholder16x9)
      expect(images.calls).toEqual([])
    })
  })
})
