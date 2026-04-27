import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import LeChangeParentDialog from '@/labs/listEditor/internal/LeChangeParentDialog.vue'
import type { NestedTree, NestedTreeNode } from '@/labs/listEditor/types/listEditorTypes'

interface Item {
  id: number
  title: string
}

let mounted: VueWrapper | null = null

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const node = (id: number, title: string, children: NestedTreeNode<Item>[] = []): NestedTreeNode<Item> => ({
  data: { id, title },
  children,
  meta: { dirty: false },
})

const buildTree = (): NestedTree<Item> => ({
  meta: { dirty: false },
  children: [
    node(1, 'Root A', [
      node(11, 'A.1'),
      node(12, 'A.2', [node(121, 'A.2.1')]),
    ]),
    node(2, 'Root B'),
    node(3, 'Root C', [node(31, 'C.1')]),
  ],
})

const calculateSubtreeDepth = (n: NestedTreeNode<Item>): number => {
  if (!n.children?.length) return 1
  return 1 + Math.max(...n.children.map(calculateSubtreeDepth))
}

const mountDialog = (
  sourceKey: number | null,
  maxDepth = 5,
  tree = buildTree(),
) => {
  const open = ref(true)
  const onConfirm = vi.fn()
  const Host = defineComponent({
    setup() {
      return () =>
        h(LeChangeParentDialog, {
          modelValue: open.value,
          'onUpdate:modelValue': (v: boolean) => {
            open.value = v
          },
          tree,
          sourceKey,
          keyField: 'id',
          maxDepth,
          resolveLabel: (raw: Item) => raw.title,
          calculateSubtreeDepth,
          onConfirm,
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, open, onConfirm }
}

const findItemByText = (text: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>('.v-list-item')).find((el) =>
    el.textContent?.includes(text),
  ) ?? null

const isDisabledItem = (text: string): boolean => {
  const el = findItemByText(text)
  if (!el) return false
  return (
    el.classList.contains('v-list-item--disabled')
    || el.getAttribute('aria-disabled') === 'true'
    || el.querySelector('[aria-disabled="true"]') !== null
  )
}

const findButton = (text: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
    b.textContent?.trim().includes(text),
  ) ?? null

describe('LeChangeParentDialog', () => {
  it('renders the title and the candidate list', async () => {
    mountDialog(11) // moving "A.1"
    await nextTick()
    await nextTick()
    expect(document.body.textContent).toContain('Change parent')
    // root option, all branches present
    expect(document.body.textContent).toContain('Root A')
    expect(document.body.textContent).toContain('Root B')
    expect(document.body.textContent).toContain('A.2')
  })

  it('disables the source row itself', async () => {
    mountDialog(12) // moving "A.2"
    await nextTick()
    await nextTick()
    expect(isDisabledItem('A.2')).toBe(true)
  })

  it('disables descendants of the source (cycle prevention)', async () => {
    mountDialog(1) // moving "Root A" — descendants A.1, A.2, A.2.1 are all disallowed
    await nextTick()
    await nextTick()
    expect(isDisabledItem('A.1')).toBe(true)
    expect(isDisabledItem('A.2')).toBe(true)
    expect(isDisabledItem('A.2.1')).toBe(true)
  })

  it('disables the current parent (no-op move)', async () => {
    mountDialog(11) // moving "A.1" whose current parent is "Root A"
    await nextTick()
    await nextTick()
    expect(isDisabledItem('Root A')).toBe(true)
  })

  it('disables targets that would exceed maxDepth but keeps shallower ones allowed', async () => {
    // moving "Root C" (subtree depth 2) with maxDepth=3:
    // - Root A (depth 1): 1+2=3 ≤ 3 → allowed
    // - A.2 (depth 2): 2+2=4 > 3 → disallowed (maxDepth)
    // - A.2.1 (depth 3): 3+2=5 > 3 → disallowed (maxDepth)
    mountDialog(3, 3)
    await nextTick()
    await nextTick()
    const a2Item = findItemByText('A.2')
    expect(a2Item?.getAttribute('data-disallowed')).toBe('true')
    expect(a2Item?.getAttribute('data-reason')).toBe('maxDepth')

    const rootAItem = findItemByText('Root A')
    expect(rootAItem?.getAttribute('data-disallowed')).toBe('false')
  })

  it('emits confirm with the chosen parentId and "last" placement by default', async () => {
    const { onConfirm } = mountDialog(11) // moving "A.1"
    await nextTick()
    await nextTick()
    findItemByText('Root B')?.click()
    await nextTick()
    findButton('Move')?.click()
    await nextTick()
    // Root B has id=2 in the tree
    expect(onConfirm).toHaveBeenCalledWith(2, 'last')
  })

  it('shows the first/last picker only when target has children', async () => {
    const { onConfirm } = mountDialog(11) // moving "A.1"
    await nextTick()
    await nextTick()

    // Click "Root C" which has one child "C.1" — picker should appear
    findItemByText('Root C')?.click()
    await nextTick()
    expect(document.body.textContent).toContain('At the beginning')
    expect(document.body.textContent).toContain('At the end')

    // Pick "first"
    const firstRadio = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).find((r) => r.value === 'first')
    firstRadio?.click()
    await nextTick()

    findButton('Move')?.click()
    await nextTick()
    expect(onConfirm).toHaveBeenCalledWith(3, 'first')
  })

  it('emits confirm with parentId=null for the top-level option', async () => {
    const { onConfirm } = mountDialog(121) // moving "A.2.1"
    await nextTick()
    await nextTick()

    // The "(top level)" option
    const rootItem = findItemByText('top level')
    rootItem?.click()
    await nextTick()

    findButton('Move')?.click()
    await nextTick()
    expect(onConfirm).toHaveBeenCalledWith(null, 'last')
  })

  it('cancel does not emit', async () => {
    const { onConfirm, open } = mountDialog(11)
    await nextTick()
    await nextTick()
    findButton('Cancel')?.click()
    await nextTick()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(open.value).toBe(false)
  })

  it('shows "no targets" empty state when every candidate is disallowed', async () => {
    // Tree with only one root, no siblings, and depth 1 — moving the only root
    // leaves "(top level)" as disallowed (already there) and no other candidates.
    const tree: NestedTree<Item> = {
      meta: { dirty: false },
      children: [node(1, 'Only Root')],
    }
    mountDialog(1, 5, tree)
    await nextTick()
    await nextTick()
    expect(document.body.textContent).toContain('No valid targets')
  })
})
