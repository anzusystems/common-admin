/* eslint-disable vue/no-ref-object-reactivity-loss */
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import {
  useKeyboardNav,
  type KeyboardNavOptions,
  type KeyboardNavViewItem,
} from '@/labs/listEditor/composables/useKeyboardNav'

const buildOptions = (
  overrides: Partial<KeyboardNavOptions> = {},
): { options: KeyboardNavOptions; mocks: ReturnType<typeof buildMocks> } => {
  const mocks = buildMocks()
  const items = ref<KeyboardNavViewItem[]>([
    { key: 1 },
    { key: 2 },
    { key: 3 },
  ])
  const options: KeyboardNavOptions = {
    viewItems: computed(() => items.value),
    variant: 'sortable',
    isReorderMode: ref(false),
    isEditing: mocks.isEditing,
    onToggleEdit: mocks.onToggleEdit,
    onCancelEdit: mocks.onCancelEdit,
    onMoveUp: mocks.onMoveUp,
    onMoveDown: mocks.onMoveDown,
    onMoveTop: mocks.onMoveTop,
    onMoveBottom: mocks.onMoveBottom,
    onCancelReorder: mocks.onCancelReorder,
    onIndent: mocks.onIndent,
    onOutdent: mocks.onOutdent,
    onToggleChildren: mocks.onToggleChildren,
    ...overrides,
  }
  return { options, mocks }
}

const buildMocks = () => ({
  isEditing: vi.fn().mockReturnValue(false),
  onToggleEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onMoveTop: vi.fn(),
  onMoveBottom: vi.fn(),
  onCancelReorder: vi.fn(),
  onIndent: vi.fn(),
  onOutdent: vi.fn(),
  onToggleChildren: vi.fn(),
})

const fireKey = (key: string, target: EventTarget | null = null): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  if (target) Object.defineProperty(e, 'target', { value: target })
  return e
}

describe('useKeyboardNav', () => {
  describe('initial state', () => {
    it('starts with no focused or grabbed row', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      expect(nav.focusedKey.value).toBeNull()
      expect(nav.grabbedKey.value).toBeNull()
    })

    it('rowTabindex returns 0 for the first row when nothing is focused', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      expect(nav.rowTabindex(1)).toBe(0)
      expect(nav.rowTabindex(2)).toBe(-1)
      expect(nav.rowTabindex(3)).toBe(-1)
    })
  })

  describe('arrow navigation in view mode', () => {
    it('ArrowDown moves focus to the next row', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowDown'))
      expect(nav.focusedKey.value).toBe(2)
    })

    it('ArrowUp moves focus to the previous row', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.setFocus(3)
      nav.handleKeydown(3, fireKey('ArrowUp'))
      expect(nav.focusedKey.value).toBe(2)
    })

    it('ArrowDown on the last row is a no-op', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.setFocus(3)
      nav.handleKeydown(3, fireKey('ArrowDown'))
      expect(nav.focusedKey.value).toBe(3)
    })

    it('Home focuses the first row', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.setFocus(3)
      nav.handleKeydown(3, fireKey('Home'))
      expect(nav.focusedKey.value).toBe(1)
    })

    it('End focuses the last row', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('End'))
      expect(nav.focusedKey.value).toBe(3)
    })
  })

  describe('Enter/Space toggling edit', () => {
    it('Enter calls onToggleEdit in view mode', () => {
      const { options, mocks } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter'))
      expect(mocks.onToggleEdit).toHaveBeenCalledWith(2)
    })

    it('Space calls onToggleEdit in view mode', () => {
      const { options, mocks } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey(' '))
      expect(mocks.onToggleEdit).toHaveBeenCalledWith(2)
    })
  })

  describe('Esc behavior in view mode', () => {
    it('Esc on a non-editing row is a no-op', () => {
      const { options, mocks } = buildOptions()
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('Escape'))
      expect(mocks.onCancelEdit).not.toHaveBeenCalled()
    })

    it('Esc on an editing row calls onCancelEdit', () => {
      const { options, mocks } = buildOptions({
        isEditing: () => true,
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Escape'))
      expect(mocks.onCancelEdit).toHaveBeenCalledWith(2)
    })
  })

  describe('reorder mode — grab + move', () => {
    it('Enter in reorder mode picks up the focused row as the grab', () => {
      const isReorderMode = ref(true)
      const { options } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter'))
      expect(nav.grabbedKey.value).toBe(2)
    })

    it('Enter while already grabbed releases the grab', () => {
      const isReorderMode = ref(true)
      const { options } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter')) // grab
      expect(nav.grabbedKey.value).toBe(2)
      nav.handleKeydown(2, fireKey('Enter')) // release
      expect(nav.grabbedKey.value).toBeNull()
    })

    it('ArrowDown while grabbed calls onMoveDown', () => {
      const isReorderMode = ref(true)
      const { options, mocks } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter'))
      nav.handleKeydown(2, fireKey('ArrowDown'))
      expect(mocks.onMoveDown).toHaveBeenCalledWith(2)
      // Focus stays on the grabbed key while it moves
      expect(nav.grabbedKey.value).toBe(2)
    })

    it('Home/End while grabbed call onMoveTop / onMoveBottom', () => {
      const isReorderMode = ref(true)
      const { options, mocks } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter')) // grab
      nav.handleKeydown(2, fireKey('Home'))
      expect(mocks.onMoveTop).toHaveBeenCalledWith(2)
      nav.handleKeydown(2, fireKey('End'))
      expect(mocks.onMoveBottom).toHaveBeenCalledWith(2)
    })

    it('Esc state machine: 1st press releases grab, 2nd press cancels reorder', () => {
      const isReorderMode = ref(true)
      const { options, mocks } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)

      nav.handleKeydown(2, fireKey('Enter')) // grab row 2
      expect(nav.grabbedKey.value).toBe(2)

      nav.handleKeydown(2, fireKey('Escape')) // 1st Esc: release grab
      expect(nav.grabbedKey.value).toBeNull()
      expect(mocks.onCancelReorder).not.toHaveBeenCalled()

      nav.handleKeydown(2, fireKey('Escape')) // 2nd Esc: cancel reorder
      expect(mocks.onCancelReorder).toHaveBeenCalledTimes(1)
    })

    it('ArrowDown without grab navigates focus instead of moving', () => {
      const isReorderMode = ref(true)
      const { options, mocks } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowDown'))
      expect(nav.focusedKey.value).toBe(2)
      expect(mocks.onMoveDown).not.toHaveBeenCalled()
    })
  })

  describe('nested-only keys', () => {
    it('ArrowLeft on an expanded row collapses it (view mode)', () => {
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, expanded: true, canExpand: true },
        { key: 2, expanded: false, canExpand: false },
      ])
      const { options, mocks } = buildOptions({
        variant: 'nested',
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowLeft'))
      expect(mocks.onToggleChildren).toHaveBeenCalledWith(1, false)
    })

    it('ArrowRight on a collapsed expandable row expands it (view mode)', () => {
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, expanded: false, canExpand: true },
      ])
      const { options, mocks } = buildOptions({
        variant: 'nested',
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowRight'))
      expect(mocks.onToggleChildren).toHaveBeenCalledWith(1, true)
    })

    it('ArrowLeft on a leaf row is a no-op', () => {
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, expanded: false, canExpand: false },
      ])
      const { options, mocks } = buildOptions({
        variant: 'nested',
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowLeft'))
      expect(mocks.onToggleChildren).not.toHaveBeenCalled()
    })

    it('ArrowRight while grabbed in reorder mode calls onIndent', () => {
      const isReorderMode = ref(true)
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, canIndent: true, canOutdent: true },
        { key: 2, canIndent: true, canOutdent: true },
      ])
      const { options, mocks } = buildOptions({
        variant: 'nested',
        isReorderMode,
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter')) // grab
      nav.handleKeydown(2, fireKey('ArrowRight'))
      expect(mocks.onIndent).toHaveBeenCalledWith(2)
    })

    it('ArrowLeft while grabbed in reorder mode calls onOutdent', () => {
      const isReorderMode = ref(true)
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, canIndent: true, canOutdent: true },
      ])
      const { options, mocks } = buildOptions({
        variant: 'nested',
        isReorderMode,
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('Enter')) // grab
      nav.handleKeydown(1, fireKey('ArrowLeft'))
      expect(mocks.onOutdent).toHaveBeenCalledWith(1)
    })

    it('flat variant ignores ArrowLeft/ArrowRight', () => {
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1, expanded: true, canExpand: true },
      ])
      const { options, mocks } = buildOptions({
        variant: 'flat',
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowLeft'))
      nav.handleKeydown(1, fireKey('ArrowRight'))
      expect(mocks.onToggleChildren).not.toHaveBeenCalled()
    })
  })

  describe('form-field passthrough', () => {
    it('ArrowDown inside a form input is not intercepted', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      const input = document.createElement('input')
      const e = fireKey('ArrowDown', input)
      nav.handleKeydown(1, e)
      // Focus did not change — composable yielded to native input behavior
      expect(nav.focusedKey.value).toBeNull()
      expect(e.defaultPrevented).toBe(false)
    })

    it('Enter inside a textarea is not intercepted', () => {
      const { options, mocks } = buildOptions()
      const nav = useKeyboardNav(options)
      const ta = document.createElement('textarea')
      nav.handleKeydown(1, fireKey('Enter', ta))
      expect(mocks.onToggleEdit).not.toHaveBeenCalled()
    })

    it('Escape still cancels edit even when target is a form input', () => {
      const { options, mocks } = buildOptions({
        isEditing: () => true,
      })
      const nav = useKeyboardNav(options)
      const input = document.createElement('input')
      nav.handleKeydown(1, fireKey('Escape', input))
      expect(mocks.onCancelEdit).toHaveBeenCalledWith(1)
    })
  })

  describe('disabled state', () => {
    it('disabled=true makes every key a no-op', () => {
      const disabled = ref(true)
      const { options, mocks } = buildOptions({ disabled })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(1, fireKey('ArrowDown'))
      nav.handleKeydown(1, fireKey('Enter'))
      nav.handleKeydown(1, fireKey('Escape'))
      expect(nav.focusedKey.value).toBeNull()
      expect(mocks.onToggleEdit).not.toHaveBeenCalled()
    })
  })

  describe('focus management on row delete', () => {
    const buildWithItems = (initial: KeyboardNavViewItem[]) => {
      const items = ref<KeyboardNavViewItem[]>(initial)
      const { options, mocks } = buildOptions({
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      return { items, options, mocks, nav }
    }

    it('falls focus to next sibling when the focused row is removed', async () => {
      const { items, nav } = buildWithItems([
        { key: 1 },
        { key: 2 },
        { key: 3 },
      ])
      nav.setFocus(2)
      await nextTick()
      // Remove row 2
      items.value = [{ key: 1 }, { key: 3 }]
      await nextTick()
      expect(nav.focusedKey.value).toBe(3)
    })

    it('falls focus to the new last row when the last row is removed', async () => {
      const { items, nav } = buildWithItems([
        { key: 1 },
        { key: 2 },
        { key: 3 },
      ])
      nav.setFocus(3)
      await nextTick()
      items.value = [{ key: 1 }, { key: 2 }]
      await nextTick()
      expect(nav.focusedKey.value).toBe(2)
    })

    it('clears focus when all rows are removed', async () => {
      const { items, nav } = buildWithItems([{ key: 1 }, { key: 2 }])
      nav.setFocus(2)
      await nextTick()
      items.value = []
      await nextTick()
      expect(nav.focusedKey.value).toBeNull()
    })

    it('does not change focus when a non-focused row is removed', async () => {
      const { items, nav } = buildWithItems([
        { key: 1 },
        { key: 2 },
        { key: 3 },
      ])
      nav.setFocus(2)
      await nextTick()
      items.value = [{ key: 2 }, { key: 3 }] // removed row 1
      await nextTick()
      expect(nav.focusedKey.value).toBe(2)
    })

    it('releases grab when the grabbed row is removed externally', async () => {
      const isReorderMode = ref(true)
      const items = ref<KeyboardNavViewItem[]>([
        { key: 1 },
        { key: 2 },
        { key: 3 },
      ])
      const { options } = buildOptions({
        isReorderMode,
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter'))
      expect(nav.grabbedKey.value).toBe(2)
      items.value = [{ key: 1 }, { key: 3 }]
      await nextTick()
      expect(nav.grabbedKey.value).toBeNull()
    })
  })

  describe('grabbedIndex + totalCount status', () => {
    it('grabbedIndex returns -1 when nothing is grabbed', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      expect(nav.grabbedIndex.value).toBe(-1)
    })

    it('grabbedIndex tracks the grabbed row position', () => {
      const isReorderMode = ref(true)
      const { options } = buildOptions({ isReorderMode })
      const nav = useKeyboardNav(options)
      nav.handleKeydown(2, fireKey('Enter'))
      expect(nav.grabbedIndex.value).toBe(1)
    })

    it('totalCount reflects the row count', () => {
      const { options } = buildOptions()
      const nav = useKeyboardNav(options)
      expect(nav.totalCount.value).toBe(3)
    })

    it('totalCount reacts to row additions / removals', async () => {
      const items = ref<KeyboardNavViewItem[]>([{ key: 1 }, { key: 2 }])
      const { options } = buildOptions({
        viewItems: computed(() => items.value),
      })
      const nav = useKeyboardNav(options)
      expect(nav.totalCount.value).toBe(2)
      items.value = [{ key: 1 }, { key: 2 }, { key: 3 }, { key: 4 }]
      await nextTick()
      expect(nav.totalCount.value).toBe(4)
    })
  })
})
