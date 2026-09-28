import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useContainerWidth } from '@/labs/listEditor/composables/useContainerWidth'

const mockWidth = ref(0)
const mockHeight = ref(0)

vi.mock('@vueuse/core', () => ({
  useElementSize: () => ({ width: mockWidth, height: mockHeight }),
}))

describe('useContainerWidth', () => {
  beforeEach(() => {
    mockWidth.value = 0
    mockHeight.value = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns isNarrow=false when width is unmeasured (0)', () => {
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(false)
  })

  it('returns isNarrow=true when width is below default threshold (769)', () => {
    mockWidth.value = 600
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(true)
  })

  it('returns isNarrow=false when width matches the threshold (boundary)', () => {
    mockWidth.value = 769
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(false)
  })

  it('returns isNarrow=true at one pixel below the threshold', () => {
    mockWidth.value = 768
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(true)
  })

  it('returns isNarrow=false on a wide viewport', () => {
    mockWidth.value = 1440
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(false)
  })

  it('reacts to width changes (resize)', () => {
    mockWidth.value = 1200
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el)
    expect(isNarrow.value).toBe(false)

    mockWidth.value = 500
    expect(isNarrow.value).toBe(true)

    mockWidth.value = 900
    expect(isNarrow.value).toBe(false)
  })

  it('honors custom threshold', () => {
    mockWidth.value = 600
    const el = ref<HTMLElement | null>(null)
    const { isNarrow } = useContainerWidth(el, 500)
    expect(isNarrow.value).toBe(false)

    mockWidth.value = 400
    expect(isNarrow.value).toBe(true)
  })

  it('exposes the live width ref', () => {
    mockWidth.value = 999
    const el = ref<HTMLElement | null>(null)
    const { width } = useContainerWidth(el)
    expect(width.value).toBe(999)
  })
})
