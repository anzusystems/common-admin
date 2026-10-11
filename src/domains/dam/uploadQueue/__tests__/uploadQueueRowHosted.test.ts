import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import useVuelidate from '@vuelidate/core'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
} from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// A row of the queue with the values a host other than the library's dialog hands it (admin-dam's): its slots,
// where cancel is offered, the duplicate line, the form of a duplicate, the scope its fields report to, how its
// keywords and authors look switched off, the edit button of a duplicate, and refresh worked out by the host. The
// row is the real one under the configuration of admin-cms; only its twenty seconds of waiting are held.

const { endPoints, extSystem, licence } = cmsConfiguration
const { Waiting, Uploading, Processing, Uploaded, Failed } = UploadQueueItemStatus
const HOST_SCOPE = Symbol('host-validation-scope')

let pinia: Pinia
let waits: LongWaits
let wrapper: VueWrapper | undefined
/** What the host collects of the validation of the row under its own scope. */
let hostValidation: { value: { $touch: () => void; $invalid: boolean } } | undefined
/** The scope the host collects under. */
let hostScope: symbol = HOST_SCOPE

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  installConsumerProfile(cmsConfiguration, createFakeDam(endPoints).client)
  waits = holdLongWaits()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  hostValidation = undefined
  hostScope = HOST_SCOPE
  waits.restore()
})

/** A row of a picked file that has its asset, in the given state, with what its host hands it besides. */
const mountRow = async (
  status: UploadQueueItemStatusType,
  parts: Partial<UploadQueueItem> = {},
  rowProps: Record<string, unknown> = {},
  slots: Record<string, (props: never) => unknown> = {}
) => {
  const item = reactive(
    useUploadQueueItemFactory().createDefault('row', UploadQueueItemType.File, status, DamAssetType.Image, 1, licence)
  )
  item.assetId = 'asset-1'
  item.fileId = 'file-1'
  Object.assign(item, parts)
  const Host = defineComponent({
    setup() {
      hostValidation = useVuelidate({ $scope: hostScope })
      return () =>
        h(
          UploadQueueItemEditable,
          {
            index: 3,
            queueKey: 'hosted',
            extSystem,
            customData: item.customData,
            keywords: item.keywords,
            authors: item.authors,
            item,
            refreshDisabled: false,
            mainFileSingleUse: item.mainFileSingleUse,
            ...rowProps,
          },
          slots as never
        )
    },
  })
  wrapper = mount(Host, {
    attachTo: document.body,
    // What the keyword and author inputs render asks the DAM for names to offer.
    global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
  })
  await flushPromises()
  return item
}

const row = () => wrapper!.findComponent(UploadQueueItemEditable)
const refreshButton = () => wrapper!.find('.mdi-refresh')
const removeButton = () => wrapper!.find('[data-cy="button-delete"]')
const cancelButton = () => wrapper!.find('.mdi-close-circle-outline')
const editButton = () =>
  wrapper!.findAll('button').find((button) => button.text() === damText('image.button.editAsset'))
const fields = () =>
  wrapper!
    .findAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')
    .filter((field) => field.attributes('aria-hidden') !== 'true')
const duplicate: Partial<UploadQueueItem> = { status: Uploaded, isDuplicate: true }
const warned = { hasError: true, message: 'broken', assetFileFailReason: AssetFileFailReason.None }

describe('the slots of a row', () => {
  it('draw what its host hands them: over the picture before the error, in place of edit, and in place of remove', async () => {
    await mountRow(
      Failed,
      { error: warned },
      {},
      {
        'image-overlay': ({ item }: { item: UploadQueueItem }) =>
          h('div', { class: 'host-overlay' }, `overlay of ${item.assetId}`),
        edit: ({ item }: { item: UploadQueueItem }) => h('button', { class: 'host-edit' }, `edit ${item.assetId}`),
        remove: ({ item, index, offered }: { item: UploadQueueItem; index: number; offered: boolean }) =>
          h('button', { class: 'host-remove' }, `remove ${item.assetId} ${index} ${offered}`),
      }
    )

    const overlay = wrapper!.find('.host-overlay')
    const error = wrapper!.find('.dam-upload-queue__overlay--error')
    expect(overlay.text()).toBe('overlay of asset-1')
    expect(overlay.element.parentElement!.classList.contains('position-relative')).toBe(true)
    expect(overlay.element.compareDocumentPosition(error.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([wrapper!.find('.host-edit').text(), editButton()]).toEqual(['edit asset-1', undefined])
    // A failed row has remove offered; the host's slot is told so, and the library's own button is not drawn.
    expect([wrapper!.find('.host-remove').text(), removeButton().exists()]).toEqual(['remove asset-1 3 true', false])
  })

  it('tell remove when it is not offered', async () => {
    await mountRow(
      Waiting,
      {},
      {},
      {
        remove: ({ offered }: { offered: boolean }) => h('button', { class: 'host-remove' }, `offered ${offered}`),
      }
    )

    expect(wrapper!.find('.host-remove').text()).toBe('offered false')
  })
})

describe('a row with the values of admin-dam', () => {
  it.each([Processing, Failed])('offers cancel also while %s, when its host says so', async (status) => {
    await mountRow(status, {}, { cancelStatuses: [Waiting, Uploading, Processing, Failed] })

    expect(cancelButton().exists()).toBe(true)
  })

  it.each([Processing, Failed])('offers no cancel while %s by default', async (status) => {
    await mountRow(status)

    expect(cancelButton().exists()).toBe(false)
  })

  it('leaves out the line that the main file is a duplicate, when its host says so', async () => {
    await mountRow(Uploaded, duplicate, { duplicateNotice: false })

    expect(wrapper!.text()).not.toContain(damText('asset.detail.info.status.duplicate'))
  })

  it('says by default that the main file is a duplicate', async () => {
    await mountRow(Uploaded, duplicate)

    expect(wrapper!.text()).toContain(damText('asset.detail.info.status.duplicate'))
  })

  it.each([
    ['switches off the form of a duplicate whose metadata can be edited, when its host says so', true, true],
    ['leaves the form of such a duplicate on by default', false, false],
  ])('%s', async (_what, disableFormOnDuplicate, disabled) => {
    await mountRow(Uploaded, { ...duplicate, canEditMetadata: true }, { disableFormOnDuplicate })

    expect(fields().length).toBeGreaterThan(0)
    expect(fields().every((field) => field.element.disabled)).toBe(disabled)
  })

  // A required custom field left empty: the host that collects under the scope the row reports to sees it.
  it.each([
    ['reports its fields to the scope its host hands it', { validationScope: HOST_SCOPE }, HOST_SCOPE],
    ['reports them to the scope of the library by default', {}, ADamAssetMetadataValidationScopeSymbol],
  ])('%s', async (_what, rowProps, scope) => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === 'title')!.attributes.required = true
    hostScope = scope

    await mountRow(Uploaded, { canEditMetadata: true }, rowProps)
    hostValidation!.value.$touch()

    expect(hostValidation!.value.$invalid).toBe(true)
  })

  it('reports nothing to another scope than the one its host hands it', async () => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === 'title')!.attributes.required = true
    hostScope = ADamAssetMetadataValidationScopeSymbol

    await mountRow(Uploaded, { canEditMetadata: true }, { validationScope: HOST_SCOPE })
    hostValidation!.value.$touch()

    expect(hostValidation!.value.$invalid).toBe(false)
  })

  it.each([
    ['hands both inputs the look its host asks for', { disabledFieldsAs: 'input' }, 'input'],
    ['hands them the chips by default', {}, 'chips'],
  ])('%s', async (_what, rowProps, look) => {
    await mountRow(Processing, {}, rowProps)

    expect([
      wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).props('disabledAs'),
      wrapper!.findComponent(AuthorRemoteAutocompleteWithCached).props('disabledAs'),
    ]).toEqual([look, look])
  })
})

// An edit button of another text than the library's: a host that hides it on a duplicate hides its own too.
describe('the edit button of a duplicate', () => {
  const ownEdit = { edit: () => h('button', { class: 'host-edit' }, 'Edit more') }

  it('is not drawn at all, neither the host one nor the library one, when its host says so', async () => {
    await mountRow(Uploaded, duplicate, { hideEditOnDuplicate: true }, ownEdit)
    expect(wrapper!.find('.host-edit').exists()).toBe(false)

    wrapper!.unmount()
    await mountRow(Uploaded, duplicate, { hideEditOnDuplicate: true })
    expect(editButton()).toBeUndefined()
  })

  it('is drawn on a row that is no duplicate, and by default on a duplicate', async () => {
    await mountRow(Uploaded, {}, { hideEditOnDuplicate: true }, ownEdit)
    expect(wrapper!.find('.host-edit').exists()).toBe(true)

    wrapper!.unmount()
    await mountRow(Uploaded, duplicate)
    expect(editButton()).toBeDefined()
  })
})

// Refresh as its host works it out, in every state a row is in; without it, the row's own rule.
describe('the refresh a row offers', () => {
  type State = [string, UploadQueueItemStatusType, Partial<UploadQueueItem>, Record<string, unknown>, boolean]
  const states: State[] = [
    ['waiting its turn', Waiting, {}, {}, false],
    ['sent for twenty seconds', Uploading, {}, {}, true],
    ['processed for twenty seconds', Processing, {}, {}, true],
    ['uploaded without its metadata for twenty seconds', Uploaded, { canEditMetadata: false }, {}, true],
    ['uploaded with its metadata', Uploaded, { canEditMetadata: true }, {}, false],
    ['failed, where a refresh may help', Failed, {}, { refreshMayHelp: true }, true],
    ['failed, where none may', Failed, {}, {}, false],
  ]
  const offered = async () => {
    await waits.elapse()
    await flushPromises()
    return refreshButton().exists()
  }

  it.each(states)('is the row’s own when its host says nothing: %s', async (_what, status, parts, props, own) => {
    await mountRow(status, parts, props)

    expect(await offered()).toBe(own)
  })

  it.each(states)('is offered when its host says so: %s', async (_what, status, parts, props) => {
    await mountRow(status, parts, { ...props, refreshOffered: true })

    expect(await offered()).toBe(true)
    // Remove comes with it.
    expect(removeButton().exists()).toBe(true)
  })

  it.each(states)('is not offered when its host says not: %s', async (_what, status, parts, props) => {
    await mountRow(status, parts, { ...props, refreshOffered: false })

    expect(await offered()).toBe(false)
    // Remove only on a failed row, as ever.
    expect(removeButton().exists()).toBe(status === Failed)
  })

  // Not even named: a host that does not hand the property leaves the row to its own rule.
  it('is offered by the row itself twenty seconds after it uploaded without its metadata, the property not named at all', async () => {
    const item = await mountRow(Uploaded, { canEditMetadata: false })
    expect(Object.keys(row().props()).includes('refreshOffered')).toBe(true)
    expect(row().vm.$props).toMatchObject({ refreshOffered: undefined })
    expect(refreshButton().exists()).toBe(false)

    expect(await offered()).toBe(true)
    await refreshButton().trigger('click')
    expect(row().emitted('refreshItem')).toEqual([[{ index: 3, assetId: item.assetId }]])
  })
})
