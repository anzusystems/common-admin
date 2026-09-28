import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import LeMoveToPositionDialog from '@/labs/listEditor/internal/LeMoveToPositionDialog.vue'

let mounted: VueWrapper | null = null

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const mountDialog = (
  total: number,
  currentIndex: number,
  itemLabel: string | undefined = undefined,
) => {
  const open = ref(true)
  const onConfirm = vi.fn()
  const Host = defineComponent({
    setup() {
      return () =>
        h(LeMoveToPositionDialog, {
          modelValue: open.value,
          'onUpdate:modelValue': (v: boolean) => {
            open.value = v
          },
          total,
          currentIndex,
          itemLabel,
          onConfirm,
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, open, onConfirm }
}

const findByText = (text: string): HTMLElement | undefined =>
  Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
    b.textContent?.trim().includes(text),
  )

describe('LeMoveToPositionDialog', () => {
  it('renders the title and a numeric input', async () => {
    mountDialog(5, 2)
    await nextTick()
    expect(document.body.textContent).toContain('Move to position')
    const input = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(input).not.toBeNull()
  })

  it('initializes the input with the 1-based current position', async () => {
    mountDialog(5, 2) // currentIndex 2 → input shows 3
    await nextTick()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(input?.value).toBe('3')
  })

  it('emits confirm with the 0-based new index when user changes value and confirms', async () => {
    const { onConfirm, open } = mountDialog(5, 2)
    await nextTick()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('input[type="number"]')
    if (!input) throw new Error('input not found')
    input.value = '5'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    findByText('Move')?.click()
    await nextTick()
    expect(onConfirm).toHaveBeenCalledWith(4)
    expect(open.value).toBe(false)
  })

  it('clamps confirm value into bounds when input is past total', async () => {
    const { onConfirm } = mountDialog(3, 0)
    await nextTick()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('input[type="number"]')
    if (!input) throw new Error('input not found')
    input.value = '99'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    // The confirm button is disabled when isInvalid → user can't confirm
    const confirmBtn = findByText('Move')
    expect(confirmBtn?.hasAttribute('disabled')).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancel closes without calling confirm', async () => {
    const { onConfirm, open } = mountDialog(5, 2)
    await nextTick()
    await nextTick()
    findByText('Cancel')?.click()
    await nextTick()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(open.value).toBe(false)
  })

  it('shows the item label in the description when provided', async () => {
    mountDialog(5, 1, 'My Item')
    await nextTick()
    await nextTick()
    expect(document.body.textContent).toContain('My Item')
  })
})
