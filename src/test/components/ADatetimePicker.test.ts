import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import dayjs from 'dayjs'
import ADatetimePicker from '@/components/datetime/ADatetimePicker.vue'
import type { DatetimeUTC, DatetimeUTCNullable } from '@/types/common'

/**
 * The "first click" cases cover a Vuetify 4.1 regression: the calendar moves focus onto the clicked
 * day before emitting, which blurs the text field and used to re-apply its stale value over the date
 * just picked. They only hold because vitest runs these in a real browser.
 */

// Weekday headers carry the __day class too, and adjacent-month days belong to another month.
const DAY_BTN =
  '.v-date-picker-month__day:not(.v-date-picker-month__weekday):not(.v-date-picker-month__day--adjacent) .v-date-picker-month__day-btn'

// 08:17 UTC — far enough from midnight to stay in February in any test TZ.
const FEBRUARY_2023 = '2023-02-08T08:17:29.000000Z'
const UTC_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000000Z$/

interface PickerEvents {
  blur: number
  focus: number
  open: number
  close: number
  afterClear: number
}

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.querySelectorAll('.v-overlay-container').forEach((n) => (n.innerHTML = ''))
})

function mountPicker(initial: DatetimeUTCNullable = null, props: Record<string, unknown> = {}) {
  const model = ref<DatetimeUTCNullable>(initial)
  const events: PickerEvents = { blur: 0, focus: 0, open: 0, close: 0, afterClear: 0 }
  const Host = defineComponent({
    setup() {
      return () =>
        h(ADatetimePicker, {
          modelValue: model.value,
          'onUpdate:modelValue': (value: DatetimeUTC | null | undefined) => {
            model.value = value ?? null
          },
          onBlur: () => (events.blur += 1),
          onFocus: () => (events.focus += 1),
          onOnOpen: () => (events.open += 1),
          onOnClose: () => (events.close += 1),
          onAfterClear: () => (events.afterClear += 1),
          ...props,
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, model, events }
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

const isCalendarOpen = () => document.querySelectorAll('.a-datetime-picker-calendar').length > 0

const nowShown = () => dayjs().format('DD.MM.YYYY HH:mm')

/** The minute can roll between acting and asserting. */
const nowWindow = (before: string) => [before, nowShown()]

/** From the icon inside the field, so the field holds focus — that is what the regression needs. */
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

async function setTimeInput(label: 'Hour' | 'Minute', value: string) {
  const input = document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement
  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

describe('ADatetimePicker', () => {
  describe('value in, value out', () => {
    it('shows the model value in local time', () => {
      mountPicker(FEBRUARY_2023)

      expect(textField().value).toBe(dayjs(FEBRUARY_2023).format('DD.MM.YYYY HH:mm'))
    })

    it('starts empty when the model is null', () => {
      mountPicker(null)

      expect(textField().value).toBe('')
    })

    it('emits the value back as a UTC string', async () => {
      const { model } = mountPicker(null)

      await typeIntoField('05.05.2025 10:00')

      expect(model.value).toMatch(UTC_SHAPE)
      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe('05.05.2025 10:00')
    })
  })

  describe('calendar', () => {
    it('applies the first click on a day when opened with an empty value', async () => {
      const { model } = mountPicker(null)
      await openCalendar()

      // Opening an empty picker preselects now, so pick another day of the same month.
      const now = dayjs()
      const target = now.date() === 1 ? now.date(2) : now.date(1)

      dayButton(target.date())!.click()
      await flushPromises()

      expect(textField().value).toMatch(
        new RegExp(`^${target.format('DD\\.MM\\.YYYY')} \\d{2}:\\d{2}$`),
      )
      expect(dayjs(model.value).format('DD.MM.YYYY')).toBe(target.format('DD.MM.YYYY'))
    })

    it('applies the first click on a day when the field already holds a value', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()

      expect(textField().value).toMatch(/^18\.02\.2023 \d{2}:\d{2}$/)
      expect(dayjs(model.value).format('DD.MM.YYYY')).toBe('18.02.2023')
    })

    it('keeps selecting further days while the calendar stays open', async () => {
      mountPicker(FEBRUARY_2023)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()
      dayButton(21)!.click()
      await flushPromises()

      expect(textField().value).toMatch(/^21\.02\.2023 \d{2}:\d{2}$/)
    })

    it('keeps the time when only the day changes', async () => {
      mountPicker(FEBRUARY_2023)
      const time = textField().value.slice(-5)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()

      expect(textField().value).toBe(`18.02.2023 ${time}`)
    })

    it('prefills the current datetime when opened on an empty field', async () => {
      const { model } = mountPicker(null)

      const before = nowShown()
      await openCalendar()

      expect(nowWindow(before)).toContain(textField().value)
      expect(model.value).toMatch(UTC_SHAPE)
    })

    it('sets the current datetime from the "now" button', async () => {
      mountPicker(FEBRUARY_2023)
      await openCalendar()

      const before = nowShown()
      bottomButton(0).click()
      await flushPromises()

      expect(nowWindow(before)).toContain(textField().value)
    })

    it('closes on the confirm button', async () => {
      const { events } = mountPicker(FEBRUARY_2023)
      await openCalendar()
      expect(isCalendarOpen()).toBe(true)
      expect(events.open).toBe(1)

      bottomButton(1).click()
      await flushPromises()

      expect(isCalendarOpen()).toBe(false)
      expect(events.close).toBeGreaterThan(0)
    })

    it('offers no calendar when disabled', () => {
      mountPicker(FEBRUARY_2023, { disabled: true })

      expect(calendarIcon()).toBeNull()
    })
  })

  describe('time picker', () => {
    it('keeps the day when only the time changes', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      await openCalendar()

      await setTimeInput('Hour', '21')
      await setTimeInput('Minute', '45')

      expect(textField().value).toBe('08.02.2023 21:45')
      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe('08.02.2023 21:45')
    })
  })

  describe('text input', () => {
    it('commits a date typed into the field on blur', async () => {
      const { model } = mountPicker(null)

      await typeIntoField('05.05.2025 10:00')

      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe('05.05.2025 10:00')
    })

    it('keeps the value when the same date is retyped', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      const shown = textField().value

      await typeIntoField(shown)

      expect(textField().value).toBe(shown)
      expect(model.value).not.toBeNull()
    })

    it('restores the last valid value when the input cannot be parsed', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      const shown = textField().value

      await typeIntoField('..')

      expect(textField().value).toBe(shown)
      expect(model.value).toBe(FEBRUARY_2023)
    })
  })

  describe('clearing', () => {
    it('clears the value when the field is emptied', async () => {
      const { model } = mountPicker(FEBRUARY_2023)

      await typeIntoField('')

      expect(model.value).toBeNull()
      expect(textField().value).toBe('')
    })

    it('keeps the value when a required field is emptied', async () => {
      const { model } = mountPicker(FEBRUARY_2023, { required: true })
      const shown = textField().value

      await typeIntoField('')

      expect(model.value).toBe(FEBRUARY_2023)
      expect(textField().value).toBe(shown)
    })

    it('falls back to the default value instead of null', async () => {
      const defaultValue = '2020-01-01T09:15:00.000000Z'
      const { model } = mountPicker(FEBRUARY_2023, { defaultValue })

      await typeIntoField('')

      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe(
        dayjs(defaultValue).format('DD.MM.YYYY HH:mm'),
      )
    })

    it('clears from the clearable icon and reports it', async () => {
      const { model, events } = mountPicker(FEBRUARY_2023, { clearable: true })

      document.querySelector<HTMLElement>('.a-datetime-picker__clearable-icon')!.click()
      await flushPromises()

      expect(model.value).toBeNull()
      expect(events.afterClear).toBe(1)
    })
  })
})
