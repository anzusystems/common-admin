import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/components/form/AFormFlagDatetimePicker.vue'
import type { DatetimeUTC, DatetimeUTCNullable } from '@/types/common'

/**
 * The collab cases pin *when* the lock travels: the picker commits typed text and calendar clicks in
 * watchers that run after the blur and close events, so a synchronous release hands the room the
 * previous value.
 */

const collab = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn(),
  change: vi.fn(),
  lockedBy: null as number | null,
}))

vi.mock('@/components/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({
    collabOptions: ref<{ enabled: boolean }>({ enabled: true }),
  }),
}))

vi.mock('@/components/collab/composables/collabField', () => ({
  useCollabField: () => ({
    releaseCollabFieldLock: collab.release,
    changeCollabFieldData: collab.change,
    acquireCollabFieldLock: collab.acquire,
    lockedByUser: ref(collab.lockedBy),
  }),
}))

const MARCH_DAY = '2023-03-01T00:00:00.000000Z'
const FEBRUARY_2023 = '2023-02-08T08:17:29.000000Z'
const COLLAB = { room: 'article:1', field: 'publishedAt', cachedUsers: new Map() }

const DAY_BTN =
  '.v-date-picker-month__day:not(.v-date-picker-month__weekday):not(.v-date-picker-month__day--adjacent) .v-date-picker-month__day-btn'

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  collab.lockedBy = null
  document.querySelectorAll('.v-overlay-container').forEach((n) => (n.innerHTML = ''))
})

function mountForm(initial: DatetimeUTCNullable = null, props: Record<string, unknown> = {}) {
  const model = ref<DatetimeUTCNullable>(initial)
  const Host = defineComponent({
    setup() {
      return () =>
        h(AFormDatetimePicker, {
          modelValue: model.value,
          'onUpdate:modelValue': (value: DatetimeUTC | null | undefined) => {
            model.value = value ?? null
          },
          ...props,
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, model }
}

const textField = () => document.querySelector('.a-datetime-picker input') as HTMLInputElement

const calendarIcon = () =>
  document.querySelector<HTMLElement>('.a-datetime-picker__calendar-icon') ?? null

const dayButton = (day: number) =>
  [...document.querySelectorAll(DAY_BTN)].find((el) => el.textContent?.trim() === String(day)) as
    | HTMLElement
    | undefined

/** [0] is "now", [1] is "confirm". */
const bottomButton = (index: number) =>
  document.querySelectorAll<HTMLElement>('.a-datetime-picker__bottom-button')[index]

async function openCalendar() {
  textField().focus()
  calendarIcon()!.click()
  await flushPromises()
}

async function typeIntoField(value: string) {
  const input = textField()
  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
  input.blur()
  await flushPromises()
}

const lastLockCall = () => {
  const acquire = collab.acquire.mock.invocationCallOrder.at(-1) ?? -1
  const release = collab.release.mock.invocationCallOrder.at(-1) ?? -1
  return acquire > release ? 'acquire' : 'release'
}

function mountFlag(initial: DatetimeUTCNullable, props: Record<string, unknown> = {}) {
  const model = ref<DatetimeUTCNullable>(initial)
  const Host = defineComponent({
    setup() {
      return () =>
        h(AFormFlagDatetimePicker, {
          modelValue: model.value,
          'onUpdate:modelValue': (value: DatetimeUTC | null | undefined) => {
            model.value = value ?? null
          },
          ...props,
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, model }
}

describe('AFormDatetimePicker', () => {
  describe('collab', () => {
    it('releases the lock with the picked day when a date calendar closes', async () => {
      mountForm(MARCH_DAY, { type: 'date', collab: COLLAB })
      await openCalendar()
      const before = collab.release.mock.calls.length

      dayButton(18)!.click()
      await flushPromises()

      const released = collab.release.mock.calls.slice(before).map((call) => call[0])
      expect(released.length).toBeGreaterThan(0)
      expect([...new Set(released)]).toEqual(['2023-03-18T00:00:00.000000Z'])
    })

    it('holds the lock while the calendar is open and releases it on confirm', async () => {
      mountForm(FEBRUARY_2023, { collab: COLLAB })
      await openCalendar()
      expect(lastLockCall()).toBe('acquire')

      bottomButton(1).click()
      await flushPromises()

      expect(lastLockCall()).toBe('release')
    })

    it('releases the lock when the field is left after the calendar was used', async () => {
      mountForm(FEBRUARY_2023, { collab: COLLAB })
      await openCalendar()
      bottomButton(1).click()
      await flushPromises()

      textField().focus()
      await flushPromises()
      expect(lastLockCall()).toBe('acquire')
      textField().blur()
      await flushPromises()

      expect(lastLockCall()).toBe('release')
    })

    it('hands the typed value to the room when the field is left', async () => {
      const { model } = mountForm(FEBRUARY_2023, { collab: COLLAB })

      await typeIntoField('05.05.2025 10:00')

      expect(model.value).toMatch(/^2025-05-05T/)
      expect(collab.release).toHaveBeenCalled()
      expect(collab.release.mock.calls.at(-1)![0]).toMatch(/^2025-05-05T/)
      expect(collab.change.mock.calls.at(-1)![0]).toMatch(/^2025-05-05T/)
    })

    it('is disabled while another user holds the lock', () => {
      collab.lockedBy = 5
      mountForm(FEBRUARY_2023, { collab: COLLAB })

      expect(textField().disabled).toBe(true)
      expect(calendarIcon()).toBeNull()
    })
  })

  describe('vuelidate', () => {
    it('marks the field required, shows the message and touches v on blur', async () => {
      const v = {
        $errors: [{ $message: 'Must be set' }],
        $touch: vi.fn(),
        required: { $params: { type: 'required' } },
        $path: 'article.publishedAt',
      }
      mountForm(FEBRUARY_2023, { v, label: 'Published' })
      await flushPromises()

      expect(document.querySelector('.v-messages__message')?.textContent?.trim()).toBe(
        'Must be set',
      )
      expect(document.querySelector('.a-datetime-picker .v-label .required')).not.toBeNull()

      textField().focus()
      textField().blur()
      await flushPromises()

      expect(v.$touch).toHaveBeenCalled()
    })
  })
})

describe('AFormFlagDatetimePicker', () => {
  it('hands the typed value to the room when the field is left', async () => {
    const { model } = mountFlag(FEBRUARY_2023, { collab: COLLAB })

    await typeIntoField('05.05.2025 10:00')

    expect(model.value).toMatch(/^2025-05-05T/)
    expect(collab.release.mock.calls.at(-1)![0]).toMatch(/^2025-05-05T/)
    expect(collab.change.mock.calls.at(-1)![0]).toMatch(/^2025-05-05T/)
  })
})
