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

vi.mock('@/labs/filters/bookmarksStore', () => ({
  MAX_BOOKMARK_ITEMS: 10,
  useFilterBookmarkStore: () => ({
    getBookmarks: async () => listItems.value,
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
    hasUnsaved: boolean | { value: boolean }
  }

const unsaved = (wrapper: VueWrapper) => {
  const raw = editorOf(wrapper).hasUnsaved
  return typeof raw === 'boolean' ? raw : raw.value
}

// Through the row's own save button, the way a user reaches it -- calling `onItemSave` straight
// would miss everything the editor does around it.
const saveOpenRow = async (wrapper: VueWrapper) => {
  const editor = wrapper.findComponent({ name: 'ASortableListEditor' })
  await (editor.vm as unknown as { onSaveClick: (vi: unknown) => Promise<void> }).onSaveClick(
    (editor.vm as unknown as { viewItemsDecorated: unknown[] }).viewItemsDecorated[1]
  )
  await flushPromises()
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

  it('sends a rename, and the saved row does not stay marked unsaved', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).updateItem(2, { customName: 'Renamed' })
    await nextTick()
    // Guards the guard: the edit really did register, so the clean check below means something.
    expect(unsaved(wrapper)).toBe(true)

    listItems.value = [bookmark(1, 'First'), bookmark(2, 'Renamed'), bookmark(3, 'Third')]
    await saveOpenRow(wrapper)

    expect(updateUserAdminConfig).toHaveBeenCalledTimes(1)
    expect(updateUserAdminConfig.mock.calls[0][0]).toBe(2)
    expect(deleteUserAdminConfig).not.toHaveBeenCalled()
    expect(updateUserAdminConfigPositions).not.toHaveBeenCalled()

    // The editor's own commit only closes the row; without the reload the saved row would sit
    // amber and the close guard would ask about a rename already persisted.
    expect(unsaved(wrapper)).toBe(false)
    expect(document.body.textContent ?? '').toContain('Renamed')
  })

  it('sends a delete through the editor, and reloads the list behind it', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    listItems.value = [bookmark(1, 'First'), bookmark(3, 'Third')]
    // The row's own delete button, so the dialog's `onDelete` is reached the way a user reaches it;
    // `controller.deleteItem` would drop the row without ever calling the endpoint.
    const deleteButtons = document.querySelectorAll<HTMLElement>('.a-le-action--delete')
    expect(deleteButtons.length).toBeGreaterThan(1)
    deleteButtons[1].click()
    await flushPromises()
    await nextTick()
    // A confirmation stands between the click and the endpoint.
    const confirm = [...document.querySelectorAll<HTMLElement>('button')].find((b) =>
      /delete|zmaza|odstr/i.test(b.textContent ?? '')
    )
    confirm?.click()
    await flushPromises()
    await nextTick()

    expect(deleteUserAdminConfig).toHaveBeenCalledWith(2)
    expect(updateUserAdminConfig).not.toHaveBeenCalled()
    // Reloaded, so the row is gone rather than merely hidden, and nothing is left marked.
    expect(document.body.textContent ?? '').not.toContain('Second')
    expect(unsaved(wrapper)).toBe(false)
  })

  it('sends the reordered ids, in the order on screen', async () => {
    const wrapper = await mountDialog()
    await openManageTab(wrapper)

    editorOf(wrapper).moveItem(0, 2)
    await nextTick()

    const dialog = wrapper.findComponent({ name: 'FilterBookmarkDialog' })
    await (dialog.vm as unknown as { onConfirm: () => void }).onConfirm()
    await flushPromises()

    expect(updateUserAdminConfigPositions).toHaveBeenCalledTimes(1)
    expect(updateUserAdminConfigPositions.mock.calls[0][0]).toEqual([2, 3, 1])
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
