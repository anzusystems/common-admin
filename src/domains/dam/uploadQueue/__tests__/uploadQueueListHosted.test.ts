import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, h, reactive, ref, type VNode } from 'vue'
import { VDialog, VList, VListItem, VMenu, VSnackbar } from 'vuetify/components'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText } from '@/domains/dam/__tests__/support/uploadUi'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
} from '@/domains/dam/types/UploadQueue'
import AssetCustomMetadataFormMassOperations from '@/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue'
import AssetQueueSelectedSidebar from '@/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import type {
  UploadQueueListBinding,
  UploadQueueMassOperationsBinding,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import UploadQueueEditable from '@/domains/dam/uploadQueue/components/UploadQueueEditable.vue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { createUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import type { UploadRefreshOutcome } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The list of a queue and its mass operations over what their host binds (admin-dam's): its rows, its sidebar, its
// refresh, its alerts. While a case says so, the library's store, its name caches, its plugin options and its alerts
// fail when anything asks for them: a list with its own binding is to ask for none of them.

const { singletons, unless } = vi.hoisted(() => {
  const singletons = { armed: false }
  /** The original, as long as no case has armed the singletons. */
  const unless = <T>(name: string, original: T): T =>
    ((...args: never[]) => {
      if (singletons.armed) throw new Error(`the library's ${name} was asked for`)
      return (original as (...args: never[]) => unknown)(...args)
    }) as T
  return { singletons, unless }
})
vi.mock('@/domains/dam/uploadQueue/store/uploadQueuesStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/dam/uploadQueue/store/uploadQueuesStore')>()
  return { ...original, useUploadQueuesStore: unless('store', original.useUploadQueuesStore) }
})
vi.mock('@/domains/dam/keyword/composables/cachedKeywords', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/dam/keyword/composables/cachedKeywords')>()
  return { ...original, useDamCachedKeywords: unless('keyword cache', original.useDamCachedKeywords) }
})
vi.mock('@/domains/dam/author/composables/cachedAuthors', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/dam/author/composables/cachedAuthors')>()
  return { ...original, useDamCachedAuthors: unless('author cache', original.useDamCachedAuthors) }
})
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/dam/composables/commonAdminCoreDamOptions')>()
  return { ...original, useCommonAdminCoreDamOptions: unless('options', original.useCommonAdminCoreDamOptions) }
})
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/system/composables/alerts')>()
  return { ...original, useAlerts: unless('alerts', original.useAlerts) }
})

const { endPoints, extSystem, licence } = cmsConfiguration

let pinia: Pinia
let waits: LongWaits
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  installConsumerProfile(cmsConfiguration, createFakeDam(endPoints).client)
  waits = holdLongWaits()
})
afterEach(() => {
  singletons.armed = false
  wrapper?.unmount()
  wrapper = undefined
  waits.restore()
})

const row = (key: string, status: UploadQueueItemStatusType = UploadQueueItemStatus.Uploaded) => {
  const item = reactive(
    useUploadQueueItemFactory().createDefault(key, UploadQueueItemType.File, status, DamAssetType.Image, 1, licence)
  )
  item.assetId = `asset-of-${key}`
  item.keywords = [`keyword-of-${key}`]
  return item as UploadQueueItem
}

/** The binding of a host: rows of its own, and a record of what the list asks of it. */
const hostBinding = (rows: UploadQueueItem[], answer: UploadRefreshOutcome = 'settled') => {
  const asked: unknown[][] = []
  const items = ref(rows)
  const binding: UploadQueueListBinding = {
    items: () => items.value,
    cancel: (item, index, queueKey) => asked.push(['cancel', item.key, index, queueKey]),
    remove: (index) => asked.push(['remove', index]),
    refresh: async (item) => (asked.push(['refresh', item.key]), answer),
    refreshMayHelp: (item) => item.key === 'b',
    warn: (key) => asked.push(['warn', key]),
    prime: (primed) => asked.push(['prime', primed.map((item) => item.key)]),
    mainFileSingleUseEnabled: false,
  }
  return { binding, asked, items }
}

const mountList = async (props: Record<string, unknown>, slots: Record<string, (props: never) => unknown> = {}) => {
  wrapper = mount(UploadQueueEditable, {
    attachTo: document.body,
    props: { queueKey: 'hosted', extSystem, massOperations: false, ...props },
    slots: slots as never,
    global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
  })
  await flushPromises()
  return wrapper
}

describe('the list of a queue with the binding of its host', () => {
  it('asks nothing of the library: not its store, its caches, its options or its alerts', async () => {
    const { binding, asked } = hostBinding([row('a'), row('b')])
    singletons.armed = true

    await mountList(
      { queue: binding, massOperationsFrom: 2, keyboardScroll: false },
      {
        item: ({ item, index, refreshMayHelp }: { item: UploadQueueItem; index: number; refreshMayHelp: boolean }) =>
          h('div', { class: 'host-row' }, `${index} ${item.key} ${refreshMayHelp}`),
        sidebar: ({ queueKey }: { queueKey: string }) => h('div', { class: 'host-sidebar' }, queueKey),
      }
    )

    expect(wrapper!.findAll('.host-row').map((hosted) => hosted.text())).toEqual(['0 a false', '1 b true'])
    expect(wrapper!.find('.host-sidebar').text()).toBe('hosted')
    expect(asked).toEqual([['prime', ['a', 'b']]])
  })

  it('hands the refresh of a row to its host, bound to that row, and says what came of it through the host', async () => {
    const { binding, asked } = hostBinding([row('a'), row('b')], 'pending')
    singletons.armed = true
    let refreshOf: Record<string, () => void> = {}

    await mountList(
      { queue: binding },
      {
        item: ({ item, refresh }: { item: UploadQueueItem; refresh: () => void }) => {
          refreshOf = { ...refreshOf, [item.key]: refresh }
          return h('div')
        },
        sidebar: () => h('div'),
      }
    )
    refreshOf.b!()
    await flushPromises()

    expect(asked.slice(1)).toEqual([
      ['refresh', 'b'],
      ['warn', 'common.damImage.queueItem.stillUploadingOrProcessing'],
    ])
  })

  it('draws the library row by default, its buttons going to the host', async () => {
    const failed = row('a', UploadQueueItemStatus.Failed)
    const { binding, asked } = hostBinding([failed])
    await mountList({ queue: binding }, { sidebar: () => h('div') })

    const libraryRow = wrapper!.findComponent(UploadQueueItemEditable)
    expect(libraryRow.props('mainFileSingleUseEnabled')).toBe(false)
    libraryRow.vm.$emit('cancelItem', { index: 0, item: failed, queueKey: 'hosted' })
    libraryRow.vm.$emit('removeItem', 0)
    libraryRow.vm.$emit('refreshItem', { index: 0, assetId: failed.assetId! })
    await flushPromises()

    expect(asked.slice(1)).toEqual([
      ['cancel', 'a', 0, 'hosted'],
      ['remove', 0],
      ['refresh', 'a'],
    ])
  })

  it('has its mass operations beside it from the number of rows its host says', async () => {
    const { binding, items } = hostBinding([row('a')])
    await mountList({ queue: binding, massOperationsFrom: 2 }, { sidebar: () => h('div', { class: 'host-sidebar' }) })
    expect(wrapper!.find('.host-sidebar').exists()).toBe(false)

    items.value = [...items.value, row('b')]
    await flushPromises()

    expect(wrapper!.find('.host-sidebar').exists()).toBe(true)
  })

  it('has them from one row by default', async () => {
    const { binding } = hostBinding([row('a')])
    await mountList({ queue: binding }, { sidebar: () => h('div', { class: 'host-sidebar' }) })

    expect(wrapper!.find('.host-sidebar').exists()).toBe(true)
  })

  it.each([
    ['scrolls with the keys by default', {}, true],
    ['leaves the keys alone when its host says so', { keyboardScroll: false }, false],
  ])('%s', async (_what, props, scrolled) => {
    const { binding } = hostBinding([row('a')])
    await mountList({ queue: binding, ...props }, { sidebar: () => h('div') })
    const key = new KeyboardEvent('keydown', { key: 'End', cancelable: true })

    document.dispatchEvent(key)

    expect(key.defaultPrevented).toBe(scrolled)
  })
})

// A key typed into a field of a row moves its caret or its value: the list stays and the key is the browser's. So is
// a key pressed in the open menu of a field, which moves through that menu, also in the dialog the list is in. Pressed
// anywhere else, also on a switch or a button, which do nothing with these keys, in the dialog the list is in, and in
// another overlay that is no menu, as a snackbar, they scroll the list as they always have.
describe('the keys that scroll a list', () => {
  const KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']
  const FROM = 600

  /** One tall row with a field of each kind, inputs that leave these keys alone, and a text. */
  const rowWithFields = (more: VNode[] = []) =>
    h('div', { style: 'height: 3000px; width: 100%' }, [
      h('input', { class: 'field-input' }),
      h('textarea', { class: 'field-textarea' }),
      h('div', { class: 'field-editable', contenteditable: 'true' }, 'typed'),
      h('input', { class: 'field-range', type: 'range' }),
      h('input', { class: 'field-radio', type: 'radio' }),
      h('select', { class: 'field-select' }, [h('option', 'one'), h('option', 'two')]),
      h('input', { class: 'switch', type: 'checkbox' }),
      h('input', { class: 'submit', type: 'submit' }),
      h('span', { class: 'no-field' }, 'text'),
      ...more,
    ])
  /** The list in the document, 300 px high. */
  const heightOf300 = async () => {
    await vi.waitFor(() => expect(document.querySelector('.asset-queue-editable .overflow-y-auto')).not.toBeNull())
    const container = document.querySelector<HTMLElement>('.asset-queue-editable .overflow-y-auto')!
    container.style.height = '300px'
    return container
  }
  const mountScrolled = async (more: VNode[] = []) => {
    const { binding } = hostBinding([row('a')])
    await mountList({ queue: binding }, { item: () => rowWithFields(more), sidebar: () => h('div') })
    return heightOf300()
  }
  /** The same list in a dialog, as the queue dialogs of admin-cms and admin-ugc have it. */
  const mountInDialog = async (more: VNode[] = []) => {
    const { binding } = hostBinding([row('a')])
    const list = () =>
      h(
        UploadQueueEditable,
        { queueKey: 'hosted', extSystem, massOperations: false, queue: binding },
        { item: () => rowWithFields(more), sidebar: () => h('div') }
      )
    wrapper = mount(() => h(VDialog, { modelValue: true }, list), {
      attachTo: document.body,
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    const container = await heightOf300()
    expect(container.closest('.v-overlay__content')).not.toBeNull()
    return container
  }
  const openMenu = () =>
    h(VMenu, { modelValue: true, activator: 'parent' }, () =>
      h(VList, () => [h(VListItem, { class: 'menu-item', title: 'one', link: true })])
    )
  /** The keys pressed on the item of the open menu, and where the list was after each. */
  const pressedInMenu = async (container: HTMLElement) => {
    await vi.waitFor(() => expect(document.querySelector('.v-menu .menu-item')).not.toBeNull())
    // Whether a key is the browser's is the menu's to say: its list takes the arrows, Home and End itself.
    return pressAll(container, '.v-menu .menu-item').map(([key, , scrolled]) => [key, scrolled])
  }
  /** Each key pressed on what the selector finds in the document, with the list scrolled to `FROM` before it. */
  const pressAll = (container: HTMLElement, target: string) =>
    KEYS.map((key) => {
      container.scrollTop = FROM
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      document.querySelector(target)!.dispatchEvent(event)
      return [key, event.defaultPrevented, container.scrollTop]
    })
  const left = () => KEYS.map((key) => [key, false, FROM])
  const scrolledAsBefore = (container: HTMLElement) => {
    const page = container.clientHeight - 50
    const bottom = container.scrollHeight - container.clientHeight
    expect([container.clientHeight, bottom > FROM + page]).toEqual([300, true])
    return [
      ['ArrowDown', true, FROM + 100],
      ['ArrowUp', true, FROM - 100],
      ['PageDown', true, FROM + page],
      ['PageUp', true, FROM - page],
      ['Home', true, 0],
      ['End', true, bottom],
    ]
  }

  it.each(['.field-input', '.field-textarea', '.field-editable', '.field-range', '.field-radio', '.field-select'])(
    'leave every one of them to the browser in a field %s, and the list stays',
    async (field) => {
      const container = await mountScrolled()

      expect(pressAll(container, field)).toEqual(left())
    }
  )

  it('leave every one of them to the open menu of a field, and the list stays', async () => {
    const container = await mountScrolled([openMenu()])

    expect(await pressedInMenu(container)).toEqual(KEYS.map((key) => [key, FROM]))
  })

  it('leave every one of them to the open menu of a field in the dialog the list is in, and the list stays', async () => {
    const container = await mountInDialog([openMenu()])

    expect(await pressedInMenu(container)).toEqual(KEYS.map((key) => [key, FROM]))
  })

  it.each(['.no-field', '.switch', '.submit'])('scroll the list, pressed on %s, as before', async (target) => {
    const container = await mountScrolled()

    expect(pressAll(container, target)).toEqual(scrolledAsBefore(container))
  })

  it('scroll the list in a dialog, pressed in that dialog outside a field, as before', async () => {
    const container = await mountInDialog()

    expect(pressAll(container, '.no-field')).toEqual(scrolledAsBefore(container))
  })

  it.each([
    ['a snackbar', VSnackbar],
    ['another dialog', VDialog],
  ])('scroll the list, pressed on a button in %s, as before', async (_what, overlay) => {
    const other = h(overlay as Component, { modelValue: true }, () =>
      h('button', { class: 'other-overlay-button' }, 'ok')
    )
    const container = await mountScrolled([other])
    await vi.waitFor(() => expect(document.querySelector('.v-overlay__content .other-overlay-button')).not.toBeNull())

    expect(pressAll(container, '.other-overlay-button')).toEqual(scrolledAsBefore(container))
  })
})

// ZK6: a row no longer in the list is not asked about at all, and one taken out while it was asked about is not
// told to try again.
describe('the refresh of a row of a bound list', () => {
  it('does not ask about a row that is no longer in the list', async () => {
    const { binding, asked } = hostBinding([row('a')], 'error')
    const { refreshItem } = createUploadQueueItemRefresh(binding)

    await refreshItem(row('gone'))

    expect(asked).toEqual([])
  })

  it.each([
    [
      'still in the list is told the state could not be loaded',
      false,
      [['warn', 'common.damImage.queueItem.refreshFailed']],
    ],
    ['taken out of the list meanwhile is not told to try again', true, []],
  ])('of a row %s', async (_what, takenOut, said) => {
    const pressed = row('a')
    const { binding, asked, items } = hostBinding([pressed], 'error')
    const { refreshItem } = createUploadQueueItemRefresh({
      ...binding,
      refresh: async (item) => {
        if (takenOut) items.value = []
        return binding.refresh(item)
      },
    })

    await refreshItem(pressed)

    expect(asked.filter(([what]) => what === 'warn')).toEqual(said)
  })
})

describe('the mass operations of a queue with the binding of its host', () => {
  const hostOperations = (types: DamAssetTypeType[]) => {
    const asked: unknown[][] = []
    const assetTypes = ref(types)
    const operations: UploadQueueMassOperationsBinding = {
      assetTypes: () => assetTypes.value,
      fillCustomDataValue: (data, forceReplace) =>
        asked.push(['custom data', data.assetType, data.elementProperty, data.value, forceReplace ?? false]),
      fillKeywords: (value, forceReplace) => asked.push(['keywords', value, forceReplace ?? false]),
      fillAuthors: (value, forceReplace) => asked.push(['authors', value, forceReplace ?? false]),
    }
    return { operations, asked, assetTypes }
  }
  const mountSidebar = async (operations: UploadQueueMassOperationsBinding) => {
    wrapper = mount(AssetQueueSelectedSidebar, {
      attachTo: document.body,
      props: { queueKey: 'hosted', extSystem, operations },
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
  }
  const panelTitles = () => wrapper!.findAll('.v-expansion-panel-title').map((title) => title.text())
  const typePanelTitles = () => panelTitles().filter((title) => title !== damText('asset.massOperations.general'))
  const button = (text: string) => wrapper!.findAll('button').find((one) => one.text() === damText(text))!

  // ZK7: a panel of each asset type in the queue, as admin-dam has them.
  it('have a panel of the custom fields of each asset type the host has rows of', async () => {
    await mountSidebar(
      hostOperations([DamAssetType.Image, DamAssetType.Video, DamAssetType.Audio, DamAssetType.Document]).operations
    )

    expect(panelTitles()).toEqual([
      damText('asset.massOperations.general'),
      damText('asset.assetType.image'),
      damText('asset.assetType.video'),
      damText('asset.assetType.audio'),
      damText('asset.assetType.document'),
    ])
  })

  it('have no panel of a type the host has no rows of', async () => {
    await mountSidebar(hostOperations([DamAssetType.Video]).operations)

    expect(panelTitles()).not.toContain(damText('asset.assetType.image'))
    expect(panelTitles()).toContain(damText('asset.assetType.video'))
  })

  it('fill and replace through the host: a custom field, the keywords and the authors', async () => {
    const { operations, asked } = hostOperations([DamAssetType.Image])
    await mountSidebar(operations)
    expect(typePanelTitles()).toEqual([damText('asset.assetType.image')])
    const form = wrapper!.findComponent(AssetCustomMetadataFormMassOperations)
    form.vm.$emit('update:modelValue', { title: 'typed' })
    wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['keyword-1'])
    await flushPromises()

    // The buttons beside one field, then the two under all of them.
    form.vm.$emit('fillEmptyField', { assetType: DamAssetType.Image, elementProperty: 'title', value: 'typed' })
    form.vm.$emit('replaceField', { assetType: DamAssetType.Image, elementProperty: 'title', value: 'typed' })
    await button('asset.massOperations.fillAllEmpty').trigger('click')
    await button('asset.massOperations.replaceAll').trigger('click')

    expect(asked).toEqual([
      ['custom data', DamAssetType.Image, 'title', 'typed', false],
      ['custom data', DamAssetType.Image, 'title', 'typed', true],
      ['custom data', DamAssetType.Image, 'title', 'typed', false],
      ['authors', [], false],
      ['keywords', ['keyword-1'], false],
      ['custom data', DamAssetType.Image, 'title', 'typed', true],
      ['authors', [], true],
      ['keywords', ['keyword-1'], true],
    ])
  })

  // The panels of the other types (ZK7) fill and replace the custom fields of their own type.
  it.each([DamAssetType.Video, DamAssetType.Audio, DamAssetType.Document])(
    'fill and replace a custom field of %s through the host, under its own type',
    async (type) => {
      const { operations, asked } = hostOperations([type])
      await mountSidebar(operations)
      // ZK7: the only panel of a type is the one of the type in the queue.
      expect(typePanelTitles()).toEqual([damText(`asset.assetType.${type}`)])
      const form = wrapper!.findComponent(AssetCustomMetadataFormMassOperations)
      // The buttons beside one field send the type the form is given.
      expect(form.props('assetType')).toBe(type)
      form.vm.$emit('update:modelValue', { title: 'typed' })
      await flushPromises()

      form.vm.$emit('fillEmptyField', { assetType: type, elementProperty: 'title', value: 'typed' })
      form.vm.$emit('replaceField', { assetType: type, elementProperty: 'title', value: 'typed' })
      await button('asset.massOperations.fillAllEmpty').trigger('click')
      await button('asset.massOperations.replaceAll').trigger('click')

      expect(asked).toEqual([
        ['custom data', type, 'title', 'typed', false],
        ['custom data', type, 'title', 'typed', true],
        ['custom data', type, 'title', 'typed', false],
        ['custom data', type, 'title', 'typed', true],
      ])
    }
  )

  // ZK8: "clear" clears the picked keywords and authors also while their inputs are not there.
  it('clear the picked keywords also while no row has keywords on, so they are gone once one has', async () => {
    const { operations, assetTypes } = hostOperations([DamAssetType.Image])
    await mountSidebar(operations)
    wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['keyword-1'])
    await flushPromises()

    // No asset type of the queue has keywords on: the input is gone.
    assetTypes.value = [DamAssetType.Document]
    await flushPromises()
    expect(wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
    await button('asset.massOperations.clearForm').trigger('click')
    assetTypes.value = [DamAssetType.Image]
    await flushPromises()

    expect(wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).props('modelValue')).toEqual([])
  })
})

// Without a binding of their host the list and its mass operations follow a change of their queue key: the rows, their
// removal, the panels and the fills. A cancel goes to the queue in the row's event, as before step 5.
describe('the list and the mass operations of the library, without a binding', () => {
  const queued = (queueKey: string, rows: UploadQueueItem[]) => {
    const store = useUploadQueuesStore(pinia)
    store.forceReloadFileInput(queueKey)
    store.getQueue(queueKey)!.items.push(...rows)
  }
  const keysIn = (queueKey: string) =>
    useUploadQueuesStore(pinia)
      .getQueueItems(queueKey)
      .map((item) => item.key)

  it('show the rows of the queue the key now names, and remove and cancel them there', async () => {
    const [b, c] = [row('b'), row('c')]
    queued('first', [row('a')])
    queued('second', [b, c])
    await mountList({ queueKey: 'first' }, { sidebar: () => h('div') })
    const rows = () => wrapper!.findAllComponents(UploadQueueItemEditable)
    expect(rows().map((one) => one.props('item').key)).toEqual(['a'])

    await wrapper!.setProps({ queueKey: 'second' })
    expect(rows().map((one) => one.props('item').key)).toEqual(['b', 'c'])
    const [rowOfB, rowOfC] = rows()
    rowOfC!.vm.$emit('removeItem', 1)
    rowOfB!.vm.$emit('cancelItem', { index: 0, item: b, queueKey: 'second' })
    await flushPromises()

    expect(keysIn('second')).toEqual([])
    expect(keysIn('first')).toEqual(['a'])
  })

  it('cancel a row in the queue its event names', async () => {
    const elsewhere = row('x')
    queued('first', [row('a')])
    queued('other', [elsewhere, row('y')])
    await mountList({ queueKey: 'first' }, { sidebar: () => h('div') })

    wrapper!
      .findComponent(UploadQueueItemEditable)
      .vm.$emit('cancelItem', { index: 0, item: elsewhere, queueKey: 'other' })
    await flushPromises()

    expect(keysIn('other')).toEqual(['y'])
    expect(keysIn('first')).toEqual(['a'])
  })

  it('have the panels of the types of the queue the key now names, and fill its rows', async () => {
    const video = row('v')
    video.assetType = DamAssetType.Video
    queued('first', [row('a')])
    queued('second', [video, row('d')])
    wrapper = mount(AssetQueueSelectedSidebar, {
      attachTo: document.body,
      props: { queueKey: 'first', extSystem },
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
    const typePanelTitles = () =>
      wrapper!
        .findAll('.v-expansion-panel-title')
        .map((title) => title.text())
        .filter((title) => title !== damText('asset.massOperations.general'))
    expect(typePanelTitles()).toEqual([damText('asset.assetType.image')])

    await wrapper!.setProps({ queueKey: 'second' })
    expect(typePanelTitles()).toEqual([damText('asset.assetType.image'), damText('asset.assetType.video')])
    wrapper!.findComponent(AssetCustomMetadataFormMassOperations).vm.$emit('update:modelValue', { title: 'typed' })
    await flushPromises()
    await wrapper!
      .findAll('button')
      .find((one) => one.text() === damText('asset.massOperations.fillAllEmpty'))!
      .trigger('click')

    const titlesIn = (queueKey: string) =>
      useUploadQueuesStore(pinia)
        .getQueueItems(queueKey)
        .map((item) => [item.key, item.customData.title])
    expect(titlesIn('second')).toEqual([
      ['v', undefined],
      ['d', 'typed'],
    ])
    expect(titlesIn('first')).toEqual([['a', undefined]])
  })
})
