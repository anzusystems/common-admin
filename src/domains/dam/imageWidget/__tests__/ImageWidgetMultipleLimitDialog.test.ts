import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { shallowRef } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleLimitDialog from '@/domains/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A widget of several images takes fifty rows in its upload queue at most. Files picked or dropped go through
// this dialog: within the limit they are queued at once, over it the user is asked. The real dialog over the real
// queue; the files that do get queued are held back at their first chunk.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'gallery'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  dam.hold('POST', dam.routes.chunk)
  waits = holdLongWaits()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const picked = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => new File([new Uint8Array(100)], `picked-${index + 1}.jpg`, { type: 'image/jpeg' })
  )

const pick = async (queued: number, files: File[]) => {
  const store = useUploadQueuesStore()
  // Rows that wait for the server and send nothing: copies to the licence.
  await store.addByCopyToLicence(
    QUEUE,
    extSystem,
    licence,
    Array.from({ length: queued }, (_, index) => `asset-queued-${index + 1}`),
    'default'
  )
  wrapper = mount(ImageWidgetMultipleLimitDialog, {
    attachTo: document.body,
    props: { queueKey: QUEUE },
    global: {
      plugins: [pinia],
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence,
          extSystem,
          licenceName: 'cms',
          extSystemConfig: useDamConfigStore().damConfigExtSystem.get(extSystem)!,
        }),
      },
    },
  })
  ;(wrapper.vm as unknown as { check: (files: File[]) => void }).check(files)
  await flushPromises()
  return { store, wrapper }
}
const dialog = () => document.body.querySelector<HTMLElement>('.v-overlay--active .v-card')
const button = (text: RegExp) =>
  Array.from(dialog()?.querySelectorAll<HTMLButtonElement>('.v-card-actions button') ?? []).find((one) =>
    text.test(one.textContent ?? '')
  )
const newTitles = (store: ReturnType<typeof useUploadQueuesStore>) =>
  store
    .getQueueItems(QUEUE)
    .map((item) => item.displayTitle)
    .filter((title) => title !== '')

describe('files picked for a widget of several images', () => {
  it('are queued at once while the queue stays within its fifty rows', async () => {
    const { store, wrapper } = await pick(10, picked(5))

    expect(dialog()).toBeNull()
    expect(store.getQueueTotalCount(QUEUE)).toBe(15)
    expect(newTitles(store)).toEqual(picked(5).map((file) => file.name))
    expect(wrapper.emitted('afterAdd')).toHaveLength(1)
  })

  it('are queued at once when they fill the queue exactly', async () => {
    const { store, wrapper } = await pick(47, picked(3))

    expect(dialog()).toBeNull()
    expect(store.getQueueTotalCount(QUEUE)).toBe(50)
    expect(wrapper.emitted('afterAdd')).toHaveLength(1)
  })

  it('are held back, and the user asked, when they would take the queue over fifty rows', async () => {
    const { store, wrapper } = await pick(49, picked(3))

    expect(dialog()!.textContent).toContain('You are trying to upload additional 3 files')
    expect(dialog()!.textContent).toContain('49 file(s) are already in progress.')
    expect(button(/Add first 1 file/)).toBeDefined()
    expect(button(/Cancel/)).toBeDefined()
    expect(store.getQueueTotalCount(QUEUE)).toBe(49)
    expect(wrapper.emitted('afterAdd')).toBeUndefined()
    expect(dam.sentTo('POST', dam.routes.start)).toEqual([])
  })

  it('are queued up to the limit, the first of them, when the user says so', async () => {
    const { store, wrapper } = await pick(49, picked(3))

    button(/Add first 1 file/)!.click()
    await flushPromises()
    await vi.waitFor(() => expect(dialog()).toBeNull())

    expect(store.getQueueTotalCount(QUEUE)).toBe(50)
    expect(newTitles(store)).toEqual(['picked-1.jpg'])
    expect(wrapper.emitted('afterAdd')).toHaveLength(1)
  })

  it('are dropped, all of them, when the user cancels, and the file input forgets them', async () => {
    const { store, wrapper } = await pick(49, picked(3))
    const fileInputKey = store.getQueue(QUEUE)!.fileInputKey

    button(/Cancel/)!.click()
    await flushPromises()
    await vi.waitFor(() => expect(dialog()).toBeNull())

    expect(store.getQueueTotalCount(QUEUE)).toBe(49)
    expect(newTitles(store)).toEqual([])
    expect(store.getQueue(QUEUE)!.fileInputKey).toBeGreaterThan(fileInputKey)
    expect(wrapper.emitted('afterAdd')).toBeUndefined()
    expect(dam.sentTo('POST', dam.routes.start)).toEqual([])
  })

  it('cannot be queued at all while the queue is full: the dialog only says so', async () => {
    const { store } = await pick(50, picked(1))

    expect(dialog()!.textContent).toContain('You are already on upload limit (50)')
    expect(button(/Add first/)).toBeUndefined()
    expect(button(/Cancel/)).toBeDefined()
    expect(store.getQueueTotalCount(QUEUE)).toBe(50)
  })
})
