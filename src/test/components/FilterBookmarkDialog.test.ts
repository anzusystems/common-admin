import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import type { UserAdminConfig } from '@/types/UserAdminConfig'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'

// The filter-bookmark manage tab, which had no test at all while it carried a hand-rolled inline
// edit on top of the deprecated `ASortable`. The rename, the delete and the saved order each reach
// a different endpoint, so what is worth pinning is that each one still reaches its own.

const updateUserAdminConfig = vi.fn(async (_id: number, _item: UserAdminConfig) => undefined)
const createUserAdminConfig = vi.fn(async (item: UserAdminConfig) => item)
const deleteUserAdminConfig = vi.fn(async (_id: number) => undefined)
const updateUserAdminConfigPositions = vi.fn(async (_ids: number[]) => undefined)
const listItems = ref<UserAdminConfig[]>([])

vi.mock('@/labs/filters/userAdminConfig', () => ({
  useUserAdminConfigApi: () => ({
    createUserAdminConfig: (item: UserAdminConfig) => createUserAdminConfig(item as never),
    useFetchUserAdminConfigList: vi.fn(),
    updateUserAdminConfigPositions: (ids: number[]) => updateUserAdminConfigPositions(ids as never),
    deleteUserAdminConfig: (id: number) => deleteUserAdminConfig(id as never),
    updateUserAdminConfig: (id: number, item: UserAdminConfig) => updateUserAdminConfig(id as never, item as never),
  }),
}))

const getBookmarks = vi.fn(async () => {
  // The store answers a failed fetch with `null`, but it can also throw outright -- putting its
  // filter and pagination together happens before any request goes out.
  if (throwFetch) {
    const hold = holdQueue.shift()
    if (hold) await hold
    throw new Error('never got as far as the request')
  }
  // Captured when the call is made, not when it answers: that is what lets one request be held
  // back and answer with the list as it was, after a later one has already brought a newer one.
  // The real store answers a failed fetch with `null` and hands back a copy of what it holds,
  // never the array in its cache. The double does both. `failFetch` is separate from the store's
  // `error` flag on purpose: that flag is one per store, shared with every other request it serves.
  const payload = failFetch ? null : [...listItems.value]
  const hold = holdQueue.shift()
  if (hold) await hold
  if (holdFetch) await holdFetch
  return payload
})
let holdFetch: Promise<void> | null = null
let holdQueue: Promise<void>[] = []
let failFetch = false
let throwFetch = false

const markStale = vi.fn()
const removeOne = vi.fn()

const bookmarkStore = {
  error: false,
  getBookmarks,
  fetchBookmarksCount: async () => listItems.value.length,
  generateKey: () => 'key',
  addOne: vi.fn(),
  removeOne,
  markStale,
}

vi.mock('@/labs/filters/bookmarksStore', () => ({
  MAX_BOOKMARK_ITEMS: 10,
  useFilterBookmarkStore: () => bookmarkStore,
}))

const bookmark = (id: number, customName: string): UserAdminConfig =>
  ({ id, customName, position: id, data: {} }) as unknown as UserAdminConfig

let mounted: VueWrapper | null = null

beforeEach(() => {
  vi.clearAllMocks()
  holdFetch = null
  holdQueue = []
  failFetch = false
  throwFetch = false
  bookmarkStore.error = false
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

const dialogVm = (wrapper: VueWrapper) =>
  wrapper.findComponent({ name: 'FilterBookmarkDialog' }).vm as unknown as {
    activeTab: string
    itemsManage: UserAdminConfig[]
    loadFailed: boolean
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

// Switching away and back, which is what the dialog treats as re-entering the tab.
const leaveAndReturn = async (wrapper: VueWrapper) => {
  const vm = dialogVm(wrapper)
  vm.activeTab = 'add'
  await settleEditor()
  vm.activeTab = 'manage'
  await settleEditor()
}

describe('re-entering the manage tab', () => {
  it("picks up what changed and does not mark it as the user's own", async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    const fetches = getBookmarks.mock.calls.length

    // A bookmark added on the add tab is the near case; anything that moved server-side reads the
    // same way from here.
    listItems.value = [bookmark(1, 'First'), bookmark(2, 'Renamed elsewhere'), bookmark(3, 'Third')]
    await leaveAndReturn(wrapper)

    expect(getBookmarks.mock.calls.length).toBe(fetches + 1)
    expect(document.body.textContent ?? '').toContain('Renamed elsewhere')
    // The fetched rows are the new baseline. Without that the refresh would hand the guard a list
    // of changes the user never made and the save would write them back as theirs.
    expect(unsaved(wrapper)).toBe(false)
  })
})

describe('when the list cannot be fetched', () => {
  it('says so rather than showing an empty list', async () => {
    failFetch = true
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    // The editor's own empty state would claim there are no bookmarks, which is not what a failed
    // request found out.
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(false)
    expect(document.querySelectorAll('.v-progress-circular').length).toBe(0)
    expect(document.querySelectorAll('.text-error').length).toBeGreaterThan(0)
  })

  it('retries on the next entry', async () => {
    failFetch = true
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    failFetch = false
    await leaveAndReturn(wrapper)

    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(true)
    expect(document.body.textContent ?? '').toContain('First')
  })

  it('does not blank a list it had already loaded', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    expect(dialogVm(wrapper).itemsManage).toHaveLength(3)

    failFetch = true
    await leaveAndReturn(wrapper)

    expect(dialogVm(wrapper).itemsManage).toHaveLength(3)
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(true)
  })
})

describe('saving the manage tab', () => {
  it('sends the deletions even when they empty the list', async () => {
    // The save button used to be gated on the list being non-empty, which left the one way of
    // sending three pending deletions switched off by the third of them.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    for (const id of [1, 2, 3]) {
      editorOf(wrapper).deleteItem(id)
      await settleEditor()
    }
    expect(deleteUserAdminConfig).not.toHaveBeenCalled()

    listItems.value = []
    await confirmDialog(wrapper)

    expect(deleteUserAdminConfig.mock.calls.map(([id]) => id)).toEqual([1, 2, 3])
    // Nothing is left to order, and an empty list is not an order.
    expect(updateUserAdminConfigPositions).not.toHaveBeenCalled()
  })

  it('writes nothing while a row is empty', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).updateItem(1, { customName: '' })
    await settleEditor()
    await confirmDialog(wrapper)

    expect(updateUserAdminConfig).not.toHaveBeenCalled()
    expect(updateUserAdminConfigPositions).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeFalsy()
  })

  it('leaves the pending work alone when the first write is refused', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    const fetches = getBookmarks.mock.calls.length

    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()
    updateUserAdminConfig.mockRejectedValueOnce(new Error('refused'))
    await confirmDialog(wrapper)

    // Nothing reached the server, so there is nothing to resync from -- and refetching here would
    // throw away the rename the user is about to retry.
    expect(getBookmarks.mock.calls.length).toBe(fetches)
    expect(unsaved(wrapper)).toBe(true)
    expect(editorOf(wrapper).getChanges().updated).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeFalsy()
  })

  it('keeps the unwritten half when one write lands and the next is refused', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    const fetches = getBookmarks.mock.calls.length

    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    // The rename is written, the order is refused.
    updateUserAdminConfigPositions.mockRejectedValueOnce(new Error('refused'))
    await confirmDialog(wrapper)

    expect(updateUserAdminConfig).toHaveBeenCalledTimes(1)
    // No refetch: it would replace the dragged order with the server's, which is the one thing the
    // user still has to send. The store is told its copy is behind instead.
    expect(getBookmarks.mock.calls.length).toBe(fetches)
    expect(markStale).toHaveBeenCalled()
    expect(dialogVm(wrapper).itemsManage.map((item) => item.id)).toEqual([2, 3, 1])
    expect(unsaved(wrapper)).toBe(true)
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeFalsy()
  })

  it('does not send a delete twice when a later write failed and the user tries again', async () => {
    // The batch is not a transaction, so pressing save again has to be safe. A rename resent is the
    // same PUT with the same result; a delete resent is a call against a row that is no longer
    // there, and it would stop the batch at the same place every time.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).deleteItem(2)
    await settleEditor()
    editorOf(wrapper).updateItem(1, { customName: 'Renamed' })
    await settleEditor()

    updateUserAdminConfig.mockRejectedValueOnce(new Error('name taken'))
    await confirmDialog(wrapper)

    expect(deleteUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(editorOf(wrapper).getChanges().deleted).toEqual([])
    // The filter bar is on screen reading the cache, and this save never reaches the refresh that
    // would have taken the deleted bookmark out of it.
    expect(removeOne.mock.calls.map(([, id]) => id)).toEqual([2])
    expect(
      editorOf(wrapper)
        .getChanges()
        .updated.map((item) => item.customName)
    ).toEqual(['Renamed'])

    listItems.value = [bookmark(1, 'Renamed'), bookmark(3, 'Third')]
    await confirmDialog(wrapper)

    expect(deleteUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(updateUserAdminConfig).toHaveBeenCalledTimes(2)
    expect(unsaved(wrapper)).toBe(false)
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeTruthy()
  })

  it('stops taking edits while the writes are going out', async () => {
    // The change set is read once, when the button is pressed. Anything typed after that would not
    // be in it, would be overwritten by the refresh at the end, and would go out with the close.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()

    let release = () => {}
    updateUserAdminConfig.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
    )
    const saving = confirmDialog(wrapper)
    await nextTick()

    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).props('loading')).toBe(true)

    release()
    await saving
  })
})

describe('two fetches in flight at once', () => {
  // The tabs switch faster than a request comes back, so a second entry can start one while the
  // first is still out.
  const held = () => {
    let release = () => {}
    const promise = new Promise<void>((resolve) => (release = () => resolve()))
    return { promise, release }
  }

  it('ignores the older answer when a newer one has already landed', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    const stale = held()
    holdQueue = [stale.promise]
    await leaveAndReturn(wrapper)

    // While that one is out, the list changes and a later entry fetches it.
    listItems.value = [bookmark(9, 'Newest')]
    await leaveAndReturn(wrapper)
    expect(dialogVm(wrapper).itemsManage.map((item) => item.customName)).toEqual(['Newest'])

    stale.release()
    await settleEditor()

    // The overtaken answer must not put the list back to what it was two switches ago.
    expect(dialogVm(wrapper).itemsManage.map((item) => item.customName)).toEqual(['Newest'])
  })

  it('does not apply one the user started working under', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    const first = held()
    const second = held()
    holdQueue = [first.promise, second.promise]
    await leaveAndReturn(wrapper)
    await leaveAndReturn(wrapper)

    // The first answer coming back does not report the tab as settled while the second is still
    // out -- otherwise the editor would take edits again in the gap between the two.
    first.release()
    await settleEditor()
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).props('loading')).toBe(true)

    // Driven through the handle rather than the rows, which the loading state keeps out of reach:
    // what is being pinned here is that the answer is dropped even if something did get through.
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    second.release()
    await settleEditor()

    expect(unsaved(wrapper)).toBe(true)
    expect(dialogVm(wrapper).itemsManage.map((item) => item.id)).toEqual([2, 3, 1])
  })
})

describe('adding a bookmark', () => {
  it('clears the name it just used', async () => {
    // The add path asks the guard before closing, so it can stay open on the other tab's pending
    // work -- with the name still in the field, a second press would create the same bookmark again.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).moveItem(0, 2)
    await settleEditor()

    const vm = wrapper.findComponent({ name: 'FilterBookmarkDialog' }).vm as unknown as {
      activeTab: string
      customName: string
      onConfirm: () => void
    }
    vm.activeTab = 'add'
    vm.customName = 'A new bookmark'
    await settleEditor()

    vm.onConfirm()
    await flushPromises()
    await nextTick()
    expect(createUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(vm.customName).toBe('')

    // Pressing it again now has nothing to send: the field is empty and `required` refuses it.
    vm.onConfirm()
    await flushPromises()
    await nextTick()
    expect(createUserAdminConfig).toHaveBeenCalledTimes(1)
  })
})

describe('a delete whose answer never came back', () => {
  // The batch is not a transaction and the network is not reliable: a DELETE can reach the server,
  // be carried out, and still fail on the way back. The next attempt then finds the row gone.
  const notFound = () => new AnzuApiAxiosError({ response: { status: 404 } } as never)

  it('reads "already gone" as done and finishes the batch', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).deleteItem(2)
    await settleEditor()

    deleteUserAdminConfig.mockRejectedValueOnce(notFound())
    listItems.value = [bookmark(1, 'First'), bookmark(3, 'Third')]
    await confirmDialog(wrapper)

    // Without this the dialog would stop on the same row on every retry and could never finish.
    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([1, 3])
    expect(unsaved(wrapper)).toBe(false)
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeTruthy()
  })

  it('still stops on a delete that failed for any other reason', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).deleteItem(2)
    await settleEditor()

    deleteUserAdminConfig.mockRejectedValueOnce(new Error('backend is down'))
    await confirmDialog(wrapper)

    expect(updateUserAdminConfigPositions).not.toHaveBeenCalled()
    expect(
      editorOf(wrapper)
        .getChanges()
        .deleted.map((item) => item.id)
    ).toEqual([2])
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeFalsy()
  })
})

describe('while a write is out', () => {
  it('takes no input anywhere in the dialog', async () => {
    // Not just the editor: switching to the other tab and typing there would be work the close that
    // follows a successful save takes with it, without asking.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()

    let release = () => {}
    updateUserAdminConfig.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
    )
    const saving = confirmDialog(wrapper)
    await nextTick()

    // The tabs are the way to the other form, so they are what has to be shut. (The dialog's own
    // buttons are globally registered wrappers that this harness does not resolve, so they cannot
    // be asserted on here.)
    const tabs = wrapper.findAllComponents({ name: 'VTab' })
    expect(tabs).toHaveLength(2)
    for (const tab of tabs) expect(tab.props('disabled')).toBe(true)

    release()
    await saving
  })
})

describe('saving while the list is being refreshed', () => {
  it('waits for the answer on its way instead of overwriting it', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    let release = () => {}
    holdQueue = [new Promise<void>((resolve) => (release = () => resolve()))]

    // The server order has changed since this tab was last looked at.
    listItems.value = [bookmark(3, 'Third'), bookmark(2, 'Second'), bookmark(1, 'First')]

    // Entering the tab again starts the refresh; the list on screen is still the old one.
    const vm = dialogVm(wrapper)
    vm.activeTab = 'add'
    await settleEditor()
    vm.activeTab = 'manage'
    await nextTick()

    await confirmDialog(wrapper)

    // Saving now would send the order being replaced and undo whatever the refresh is bringing.
    expect(updateUserAdminConfigPositions).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'FilterBookmarkDialog' }).emitted('onClose')).toBeFalsy()

    release()
    await settleEditor()

    // Once it has landed, the same press works -- on the list that arrived.
    await confirmDialog(wrapper)
    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([3, 2, 1])
  })
})

describe('while a bookmark is being created', () => {
  it('holds the form it was created from', async () => {
    // The success path clears this field and closes, so anything typed while the POST is out would
    // be thrown away without a word.
    const wrapper = await mountDialog()
    const vm = wrapper.findComponent({ name: 'FilterBookmarkDialog' }).vm as unknown as {
      customName: string
      onConfirm: () => void
    }
    vm.customName = 'A new bookmark'
    await settleEditor()

    let release = () => {}
    createUserAdminConfig.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({} as UserAdminConfig)))
    )
    vm.onConfirm()
    await nextTick()

    expect(wrapper.findComponent({ name: 'AFormTextField' }).props('disabled')).toBe(true)
    const switches = wrapper.findAllComponents({ name: 'AFormSwitch' })
    expect(switches).toHaveLength(2)
    for (const item of switches) expect(item.props('disabled')).toBe(true)

    release()
    await flushPromises()
  })
})

describe('trying to close while a write is out', () => {
  it('does not ask about work that is already on its way', async () => {
    // The toolbar's X and the escape key reach the model without passing anything the write phase
    // disables. Asking "discard your changes?" there and then writing them anyway, whatever the
    // answer, is the guard telling the user something that is not true.
    const wrapper = await mountDialog()
    await openManageTab(wrapper)
    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await settleEditor()

    let release = () => {}
    updateUserAdminConfig.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
    )
    const saving = confirmDialog(wrapper)
    await nextTick()

    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    const vm = dialog.vm as unknown as { requestClose: () => void; guard: { promptOpen: { value: boolean } } }
    vm.requestClose()
    await flushPromises()

    expect(vm.guard.promptOpen.value).toBe(false)
    expect(dialog.emitted('onClose')).toBeFalsy()
    // The escape key and a click outside go straight to the model, so they are held off there.
    expect(wrapper.findComponent({ name: 'VDialog' }).props('persistent')).toBe(true)

    listItems.value = [bookmark(1, 'First'), bookmark(2, 'Renamed'), bookmark(3, 'Third')]
    release()
    await saving
    // `confirmDialog` returns while the write is still held, so the rest of the save runs here.
    await settleEditor()

    // The save's own close still happens, once the write it was waiting for has landed.
    expect(dialog.emitted('onClose')).toBeTruthy()
  })

  it('still closes after a bookmark has been added', async () => {
    // The add path closes itself from inside the write, so the refusal above must not catch it.
    const wrapper = await mountDialog()
    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    const vm = dialog.vm as unknown as { customName: string; onConfirm: () => void }
    vm.customName = 'A new bookmark'
    await settleEditor()

    vm.onConfirm()
    await flushPromises()
    await nextTick()

    expect(createUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(dialog.emitted('onClose')).toBeTruthy()
  })
})

describe('an error flag raised by somebody else', () => {
  it('does not turn a good answer into a failed one', async () => {
    // The store keeps one `error` flag for everything it fetches -- this dialog's own bookmark
    // count among them -- so a count that failed on the add tab must not make the manage tab's
    // successful fetch read as a failure. Only the answer to a request says how it went.
    bookmarkStore.error = true

    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(true)
    expect(document.body.textContent ?? '').toContain('First')
    expect(document.querySelectorAll('.text-error').length).toBe(0)
  })
})

describe('a fetch that throws after a newer one has answered', () => {
  it('does not put the tab into an error state over it', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    // The older fetch is held and will throw; a newer one answers while it is still out.
    let failOlder = () => {}
    holdQueue = [new Promise<void>((resolve) => (failOlder = () => resolve()))]
    throwFetch = true
    const vm = dialogVm(wrapper)
    vm.activeTab = 'add'
    await settleEditor()
    vm.activeTab = 'manage'
    await nextTick()

    throwFetch = false
    listItems.value = [bookmark(1, 'First'), bookmark(2, 'Renamed elsewhere'), bookmark(3, 'Third')]
    await leaveAndReturn(wrapper)

    // Read off the model rather than the page: the editor is still showing its loading state,
    // because the fetch that is about to throw has not come back yet.
    const names = () => dialogVm(wrapper).itemsManage.map((item) => item.customName)
    expect(names()).toEqual(['First', 'Renamed elsewhere', 'Third'])

    failOlder()
    await settleEditor()

    // The answer that overtook it is the current one, and it worked.
    expect(dialogVm(wrapper).loadFailed).toBe(false)
    expect(names()).toEqual(['First', 'Renamed elsewhere', 'Third'])
    expect(wrapper.findComponent({ name: 'ASortableListEditor' }).exists()).toBe(true)
    expect(document.querySelectorAll('.text-error').length).toBe(0)
  })
})
