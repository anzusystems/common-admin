import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AFormTextField from '@/domains/form/components/AFormTextField.vue'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'

// They hold the lock while focused: back in an active room they ask for it again (`useCollabField`'s option).

const reacquire = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: (_room: string, _field: string, _disableAutoUnsubscribe?: boolean, reacquireWhenActive?: boolean) => {
    reacquire.calls.push(reacquireWhenActive)
    return {
      releaseCollabFieldLock: vi.fn(),
      acquireCollabFieldLock: vi.fn(),
      addCollabFieldLockStatusListener: vi.fn(),
      addCollabGatheringBufferDataListener: vi.fn(),
      lockedByUser: ref<number | null>(null),
    }
  },
}))

describe('collab text fields', () => {
  it.each([
    ['AFormTextField', AFormTextField],
    ['AFormTextarea', AFormTextarea],
  ])('%s asks for its lock again when the room turns active', (_name, component) => {
    reacquire.calls.length = 0
    const wrapper = mount(
      component as never,
      {
        props: { modelValue: '', label: 'Title', collab: { room: 'article:1', field: 'title', cachedUsers: {} } },
        global: { stubs: { ACollabLockedByUser: true } },
      } as never
    )

    expect(reacquire.calls).toEqual([true])
    wrapper.unmount()
  })
})
