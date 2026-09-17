import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import type { UserAdminConfig } from '@/types/UserAdminConfig'

// The filter-bookmark manage tab, which had no test at all while it carried a hand-rolled inline
// edit on top of the deprecated `ASortable`. The rename, the delete and the saved order each reach
// a different endpoint, so what is worth pinning is that each one still reaches its own.

const updateUserAdminConfig = vi.fn(async (_id: number, _item: UserAdminConfig) => undefined)
const deleteUserAdminConfig = vi.fn(async (_id: number) => undefined)
const updateUserAdminConfigPositions = vi.fn(async (_ids: number[]) => undefined)
const listItems = ref<UserAdminConfig[]>([])

vi.mock('@/labs/filters/userAdminConfig', () => ({
  useUserAdminConfigApi: () => ({
    createUserAdminConfig: vi.fn(),
    useFetchUserAdminConfigList: vi.fn(),
    updateUserAdminConfigPositions: (ids: number[]) => updateUserAdminConfigPositions(ids as never),
    deleteUserAdminConfig: (id: number) => deleteUserAdminConfig(id as never),
    updateUserAdminConfig: (id: number, item: UserAdminConfig) => updateUserAdminConfig(id as never, item as never),
  }),
}))

const getBookmarks = vi.fn(async () => {
  if (holdFetch) await holdFetch
  return listItems.value
})
let holdFetch: Promise<void> | null = null

vi.mock('@/labs/filters/bookmarksStore', () => ({
  MAX_BOOKMARK_ITEMS: 10,
  useFilterBookmarkStore: () => ({
    getBookmarks,
    fetchBookmarksCount: async () => listItems.value.length,
    generateKey: () => 'key',
    addOne: vi.fn(),
  }),
}))

const bookmark = (id: number, customName: string): UserAdminConfig =>
  ({ id, customName, position: id, data: {} }) as unknown as UserAdminConfig

let mounted: VueWrapper | null = null

beforeEach(() => {
  vi.clearAllMocks()
  holdFetch = null
  listItems.value = [bookmark(1, 'First'), bookmark(2, 'Second'), bookmark(3, 'Third')]
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountDialog = async () => {
  const FilterBookmarkDialog = (await import('@/labs/filters/FilterBookmarkDialog.vue')).default
  const Host = defineComponent({
    setup() {
      return () =>
        h(FilterBookmarkDialog as never, {
          client: () => ({}),
          system: 'cms',
          subject: 'article',
          user: 7,
        })
    },
  })
  mounted = mount(Host, {
    global: {
      provide: {
        // `useFilterHelpers` reads the config's general block, so the double has to carry it.
        [FilterConfigKey as symbol]: { general: { system: 'cms', subject: 'article' } },
        [FilterDataKey as symbol]: {},
        [DatatablePaginationKey as symbol]: ref({ sortBy: null }),
      },
    },
    attachTo: document.body,
  }) as VueWrapper
  await flushPromises()
  return mounted
}

// The manage tab is behind a tab switch; the dialog's own instance holds the flag.
const openManageTab = async (wrapper: VueWrapper) => {
  const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
  const vm = dialog.vm as unknown as { activeTab: string }
  vm.activeTab = 'manage'
  await nextTick()
  await flushPromises()
  await nextTick()
}

const editorOf = (wrapper: VueWrapper) =>
  wrapper.findComponent({ name: 'ASortableListEditor' }).vm as unknown as {
    updateItem: (key: number, next: Partial<UserAdminConfig>) => void
    deleteItem: (key: number) => void
    moveItem: (from: number, to: number) => void
    getChanges: () => { updated: UserAdminConfig[]; deleted: UserAdminConfig[] }
    hasUnsaved: boolean | { value: boolean }
  }

const settleEditor = async () => {
  await nextTick()
  await flushPromises()
  await nextTick()
}

const unsaved = (wrapper: VueWrapper) => {
  const raw = editorOf(wrapper).hasUnsaved
  return typeof raw === 'boolean' ? raw : raw.value
}

// The dialog's own primary button, which is now the only thing that persists this tab.
const confirmDialog = async (wrapper: VueWrapper) => {
  const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
  await (dialog.vm as unknown as { onConfirm: () => void }).onConfirm()
  await flushPromises()
  await nextTick()
}

describe('filter bookmark manage tab', () => {
  it('lists the bookmarks it fetched', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    // `VDialog` teleports its card, so the rows are in the document rather than under the wrapper.
    const rendered = document.body.textContent ?? ''
    expect(rendered).toContain('First')
    expect(rendered).toContain('Third')
  })

  it('saves a rename and the order together, and nothing is left marked', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    // A tick between them: each write goes out through `v-model` and comes back as a prop, so
    // issuing both in one tick would have the second read the array from before the first.
    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()
    // Guards the guard: both changes really registered, so the clean check below means something.
    expect(unsaved(wrapper)).toBe(true)

    listItems.value = [bookmark(2, 'Renamed'), bookmark(3, 'Third'), bookmark(1, 'First')]
    await confirmDialog(wrapper)

    expect(updateUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(updateUserAdminConfig.mock.calls[0][0]).toBe(2)
    expect(updateUserAdminConfigPositions).toHaveBeenCalledTimes(1)
    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([2, 3, 1])
    // The other half of this test's name: the save re-baselines, so the guard has nothing left to
    // ask about. Without the commit the editor would still read dirty against the fetched list.
    expect(unsaved(wrapper)).toBe(false)
  })

  it('does not lose a pending reorder when another row is edited', async () => {
    // What the per-row save got wrong: re-baselining the saved row meant reloading the list, and
    // the reload replaced the array the pending order lives in.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()
    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()

    await confirmDialog(wrapper)

    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([2, 3, 1])
  })

  it('holds a delete until the save, and sends it there', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    const deleteButtons = document.querySelectorAll<HTMLElement>('.a-le-action--delete')
    expect(deleteButtons.length).toBeGreaterThan(1)
    deleteButtons[1].click()
    await settleEditor()
    const confirm = [...document.querySelectorAll<HTMLElement>('button')].find((button) =>
      /delete|zmaza|odstr/i.test(button.textContent ?? '')
    )
    confirm?.click()
    await settleEditor()

    // Nothing has reached the server yet -- the row is a pending deletion, and it counts as
    // unsaved work the guard will ask about.
    expect(deleteUserAdminConfig).not.toHaveBeenCalled()
    expect(unsaved(wrapper)).toBe(true)

    listItems.value = [bookmark(1, 'First'), bookmark(3, 'Third')]
    await confirmDialog(wrapper)

    expect(deleteUserAdminConfig).toHaveBeenCalledWith(2)
    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([1, 3])
  })

  it('does not lose a pending rename when another row is deleted', async () => {
    // The delete path used to reload mid-edit, which replaced the array the typed text lives in.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).updateItem(1, { customName: 'Renamed' })
    await settleEditor()

    const deleteButtons = document.querySelectorAll<HTMLElement>('.a-le-action--delete')
    deleteButtons[deleteButtons.length - 1].click()
    await settleEditor()
    const confirm = [...document.querySelectorAll<HTMLElement>('button')].find((button) =>
      /delete|zmaza|odstr/i.test(button.textContent ?? '')
    )
    confirm?.click()
    await settleEditor()

    expect(
      editorOf(wrapper)
        .getChanges()
        .updated.map((item) => item.customName)
    ).toEqual(['Renamed'])
  })

  it('keeps asking on the way out after a glance at the other tab', async () => {
    // The editor is the only thing registering this tab's pending work with the guard, so a `v-if`
    // on the tab would unmount it and let the dialog close on a dragged order without a word.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).moveItem(0, 2)
    await nextTick()

    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    const vm = dialog.vm as unknown as {
      activeTab: string
      requestClose: () => void
      guard: { promptOpen: { value: boolean } }
    }
    vm.activeTab = 'add'
    await nextTick()
    await flushPromises()

    vm.requestClose()
    await flushPromises()

    expect(vm.guard.promptOpen.value).toBe(true)
    expect(dialog.emitted('onClose')).toBeFalsy()
  })
})

describe('leaving the manage tab with an unapplied order', () => {
  it('asks before closing once a row has moved, and closes straight away before that', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    const vm = dialog.vm as unknown as { requestClose: () => void; guard: { promptOpen: { value: boolean } } }

    // Nothing pending: the cancel path closes and the parent is told.
    vm.requestClose()
    await flushPromises()
    expect(vm.guard.promptOpen.value).toBe(false)
    expect(dialog.emitted('onClose')).toBeTruthy()

    // A drag is the one thing here that waits for the save button.
    const second = await mountDialog()
    await openManageTab(second)
    editorOf(second).moveItem(0, 2)
    await nextTick()
    const secondDialog = second.findComponent({ name: 'FilterBookmarkDialog' })
    const secondVm = secondDialog.vm as unknown as {
      requestClose: () => void
      guard: { promptOpen: { value: boolean } }
    }
    secondVm.requestClose()
    await flushPromises()

    expect(secondVm.guard.promptOpen.value).toBe(true)
    expect(secondDialog.emitted('onClose')).toBeFalsy()
  })
})

describe('adding a bookmark while the manage tab has pending work', () => {
  it('does not close over it', async () => {
    // Adding is a decision about the add tab; it says nothing about a reorder left pending on the
    // other one, so the close it triggers still has to go through the guard.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    const vm = dialog.vm as unknown as {
      activeTab: string
      customName: string
      onConfirm: () => void
      guard: { promptOpen: { value: boolean } }
    }
    vm.activeTab = 'add'
    vm.customName = 'A new bookmark'
    await settleEditor()

    vm.onConfirm()
    await flushPromises()
    await nextTick()

    expect(vm.guard.promptOpen.value).toBe(true)
    expect(dialog.emitted('onClose')).toBeFalsy()
  })
})

describe('loading the manage tab', () => {
  it('shows a spinner until the first fetch settles, then the editor whether or not it is empty', async () => {
    let release = () => {}
    holdFetch = new Promise<void>((resolve) => (release = () => resolve()))

    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    // The editor waits for data so its baseline is the fetched list; something has to stand in for
    // it meanwhile, or the tab is blank for the whole first load.
    expect(document.querySelectorAll('.v-progress-circular').length).toBeGreaterThan(0)
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(false)

    listItems.value = []
    release()
    await settleEditor()

    // Empty is still mounted -- the editor has its own empty state, and staying mounted is what
    // keeps the guard armed.
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(true)
  })

  it('does not refetch over pending work when the other tab is visited', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    const fetchesAfterFirstEntry = getBookmarks.mock.calls.length

    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    const vm = wrapper.findComponent({ name: 'FilterBookmarkDialog' }).vm as unknown as { activeTab: string }
    vm.activeTab = 'add'
    await settleEditor()
    vm.activeTab = 'manage'
    await settleEditor()

    expect(getBookmarks.mock.calls.length).toBe(fetchesAfterFirstEntry)
    expect(editorOf(wrapper).getChanges().updated).toEqual([])
    expect(unsaved(wrapper)).toBe(true)
  })

  it('tells the editor it is loading rather than swapping it out', async () => {
    // The reload at the end of a save must not unmount the editor: it is the only thing holding
    // this tab's registration with the guard, so an unmount mid-save disarms it.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    let release = () => {}
    holdFetch = new Promise<void>((resolve) => (release = () => resolve()))
    const saving = confirmDialog(wrapper)
    await nextTick()
    await nextTick()

    const editor = wrapper.findComponent({ name: 'ASortableListEditor' })
    expect(editor.exists()).toBe(true)
    expect(editor.props('loading')).toBe(true)

    release()
    await saving
  })
})
