import { describe, it, expect, afterEach, vi } from 'vitest'
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
  /** The model as each `blur` / `onClose` saw it. */
  blurredWith: DatetimeUTCNullable[]
  closedWith: DatetimeUTCNullable[]
}

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.querySelectorAll('.v-overlay-container').forEach((n) => (n.innerHTML = ''))
})

function mountPicker(initial: DatetimeUTCNullable = null, props: Record<string, unknown> = {}) {
  const model = ref<DatetimeUTCNullable>(initial)
  const events: PickerEvents = {
    blur: 0,
    focus: 0,
    open: 0,
    close: 0,
    afterClear: 0,
    blurredWith: [],
    closedWith: [],
  }
  const Host = defineComponent({
    setup() {
      return () =>
        h(ADatetimePicker, {
          modelValue: model.value,
          'onUpdate:modelValue': (value: DatetimeUTC | null | undefined) => {
            model.value = value ?? null
          },
          onBlur: () => {
            events.blur += 1
            events.blurredWith.push(model.value)
          },
          onFocus: () => (events.focus += 1),
          onOnOpen: () => (events.open += 1),
          onOnClose: () => {
            events.close += 1
            events.closedWith.push(model.value)
          },
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

const adjacentDayButton = (day: number) =>
  [
    ...document.querySelectorAll(
      '.v-date-picker-month__day--adjacent .v-date-picker-month__day-btn',
    ),
  ].find((el) => el.textContent?.trim() === String(day)) as HTMLElement | undefined

const selectedDayButton = () =>
  document.querySelector('.v-date-picker-month__day--selected .v-date-picker-month__day-btn')

const timeInput = (label: 'Hour' | 'Minute') =>
  document.querySelector(`input[aria-label="${label}"]`)

const shownMonth = () =>
  document.querySelector('.v-date-picker-controls')?.textContent?.replace(/\s+/g, ' ').trim()

const nextMonthButton = () => {
  const buttons = document.querySelectorAll<HTMLElement>('.v-date-picker-controls__month .v-btn')
  return buttons[buttons.length - 1]
}

const MARCH_DAY = '2023-03-01T00:00:00.000000Z'
const UTC_MIDNIGHT_SHAPE = /^\d{4}-\d{2}-\d{2}T00:00:00\.000000Z$/

const todayStored = () => dayjs().format('YYYY-MM-DD') + 'T00:00:00.000000Z'

/** The day can roll between acting and asserting. */
const todayWindow = (before: string) => [before, todayStored()]

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

/** Puts text into the field without leaving it. */
async function typeWithoutBlur(value: string) {
  const input = textField()
  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

const timeShown = () =>
  `${(timeInput('Hour') as HTMLInputElement).value}:${(timeInput('Minute') as HTMLInputElement).value}`

const errorMessage = () => document.querySelector('.v-messages__message')?.textContent?.trim()

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

    it('applies a day of an adjacent month without overflowing', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      await openCalendar()

      adjacentDayButton(31)!.click()
      await flushPromises()

      expect(dayjs(model.value).format('DD.MM.YYYY')).toBe('31.01.2023')
    })

    it('commits what was typed when the calendar is opened from the icon', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      await typeWithoutBlur('05.05.2025 10:00')

      await openCalendar()

      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe('05.05.2025 10:00')
      expect(selectedDayButton()?.textContent?.trim()).toBe('5')
    })

    it('moves the time inputs to the current time after "now"', async () => {
      mountPicker(FEBRUARY_2023)
      await openCalendar()
      expect(timeShown()).toBe(dayjs(FEBRUARY_2023).format('HH:mm'))

      const before = nowShown()
      bottomButton(0).click()
      await flushPromises()

      expect(nowWindow(before).map((shown) => shown.slice(-5))).toContain(timeShown())
    })

    it('sets the last second of the minute from "now" with lastMinuteMoment', async () => {
      const { model } = mountPicker(FEBRUARY_2023, { lastMinuteMoment: true })
      await openCalendar()

      bottomButton(0).click()
      await flushPromises()

      expect(model.value).toMatch(/:59\.000000Z$/)
    })

    // Vuetify moves the calendar to the month of a new value itself (3.5.17 and up), which is why
    // this component no longer remounts the picker to do it.
    it('opens on the month of the current value and follows it', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      await openCalendar()
      expect(shownMonth()).toContain(dayjs(FEBRUARY_2023).format('MMMYYYY'))

      model.value = '2021-07-14T10:00:00.000000Z'
      await flushPromises()

      expect(shownMonth()).toContain('Jul2021')
    })

    it('jumps to the current month from "now"', async () => {
      mountPicker(FEBRUARY_2023)
      await openCalendar()

      bottomButton(0).click()
      await flushPromises()

      expect(shownMonth()).toContain(dayjs().format('MMMYYYY'))
    })

    // Vuetify's navigation skips an unchanged day, so this one needs the picker remount.
    it('returns to the current month from "now" after the user paged away', async () => {
      mountPicker(dayjs().format('YYYY-MM-DD') + 'T12:00:00.000000Z')
      await openCalendar()

      nextMonthButton().click()
      await flushPromises()
      expect(shownMonth()).toContain(dayjs().add(1, 'month').format('MMMYYYY'))

      bottomButton(0).click()
      await flushPromises()

      expect(shownMonth()).toContain(dayjs().format('MMMYYYY'))
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

    it('keeps the value, seconds included, when the same date is retyped', async () => {
      const { model } = mountPicker(FEBRUARY_2023)
      const shown = textField().value

      await typeIntoField(shown)

      expect(textField().value).toBe(shown)
      expect(model.value).toBe(FEBRUARY_2023)
    })

    it('commits a typed date on Enter while the field keeps focus', async () => {
      const { model } = mountPicker(null)
      await typeWithoutBlur('05.05.2025 10:00')

      textField().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(dayjs(model.value).format('DD.MM.YYYY HH:mm')).toBe('05.05.2025 10:00')
      expect(document.activeElement).toBe(textField())
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

    it('resets to the default value from the clearable icon and hides the icon', async () => {
      const defaultValue = '2020-01-01T09:15:00.000000Z'
      const { model, events } = mountPicker(FEBRUARY_2023, { clearable: true, defaultValue })

      document.querySelector<HTMLElement>('.a-datetime-picker__clearable-icon')!.click()
      await flushPromises()

      expect(model.value).toBe(defaultValue)
      expect(events.afterClear).toBe(1)
      expect(document.querySelector('.a-datetime-picker__clearable-icon')).toBeNull()
    })

    it('clears from the clearable icon and reports it', async () => {
      const { model, events } = mountPicker(FEBRUARY_2023, { clearable: true })

      document.querySelector<HTMLElement>('.a-datetime-picker__clearable-icon')!.click()
      await flushPromises()

      expect(model.value).toBeNull()
      expect(events.afterClear).toBe(1)
    })
  })

  describe('messages', () => {
    it('shows the error messages it is handed', async () => {
      mountPicker(FEBRUARY_2023, { errorMessages: ['Too late'] })
      await flushPromises()

      expect(errorMessage()).toBe('Too late')
    })

    it('shows the required message once an empty field is left', async () => {
      mountPicker(null, { required: true })
      expect(errorMessage()).toBeUndefined()

      await typeIntoField('')

      expect(errorMessage()).toBeTruthy()
    })
  })

  describe('type: date', () => {
    const dateProps = { type: 'date' as const }

    it('shows the stored day', () => {
      mountPicker(MARCH_DAY, dateProps)

      expect(textField().value).toBe('01.03.2023')
    })

    it('drops the time from a stored value that carries one', async () => {
      const { model } = mountPicker('2026-09-08T12:00:00.000000Z', dateProps)
      await flushPromises()

      expect(textField().value).toBe('08.09.2026')
      expect(model.value).toBe('2026-09-08T00:00:00.000000Z')
    })

    it('offers no time inputs', async () => {
      mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      expect(isCalendarOpen()).toBe(true)
      expect(timeInput('Hour')).toBeNull()
      expect(timeInput('Minute')).toBeNull()
    })

    it('preselects the stored day in the calendar', async () => {
      mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      expect(selectedDayButton()?.textContent?.trim()).toBe('1')
    })

    it('emits UTC midnight of the clicked day', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()

      expect(model.value).toBe('2023-03-18T00:00:00.000000Z')
      expect(textField().value).toBe('18.03.2023')
    })

    it('closes the calendar after picking a day', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()

      expect(isCalendarOpen()).toBe(false)
      expect(model.value).toBe('2023-03-18T00:00:00.000000Z')
    })

    it('takes a day of an adjacent month as that month', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      adjacentDayButton(28)!.click()
      await flushPromises()

      expect(model.value).toBe('2023-02-28T00:00:00.000000Z')
    })

    it('emits UTC midnight for a typed day', async () => {
      const { model } = mountPicker(null, dateProps)

      await typeIntoField('08.09.2026')

      expect(model.value).toBe('2026-09-08T00:00:00.000000Z')
      expect(textField().value).toBe('08.09.2026')
    })

    it('leaves the value alone when the shown day is retyped', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)

      await typeIntoField('01.03.2023')

      expect(model.value).toBe(MARCH_DAY)
      expect(textField().value).toBe('01.03.2023')
    })

    it('prefills today when opened on an empty field', async () => {
      const { model } = mountPicker(null, dateProps)

      const before = todayStored()
      await openCalendar()

      expect(model.value).toMatch(UTC_MIDNIGHT_SHAPE)
      expect(todayWindow(before)).toContain(model.value)
    })

    it('sets today from the bottom button', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      const before = todayStored()
      bottomButton(0).click()
      await flushPromises()

      expect(todayWindow(before)).toContain(model.value)
    })

    it('clears the value when the field is emptied', async () => {
      const { model } = mountPicker(MARCH_DAY, dateProps)

      await typeIntoField('')

      expect(model.value).toBeNull()
      expect(textField().value).toBe('')
    })

    it('falls back to the default day instead of null', async () => {
      const defaultValue = '2020-01-01T00:00:00.000000Z'
      const { model } = mountPicker(MARCH_DAY, { ...dateProps, defaultValue })

      await typeIntoField('')

      expect(model.value).toBe(defaultValue)
      expect(textField().value).toBe('01.01.2020')
    })

    it('keeps the value when a required field is emptied', async () => {
      const { model } = mountPicker(MARCH_DAY, { ...dateProps, required: true })

      await typeIntoField('')

      expect(model.value).toBe(MARCH_DAY)
      expect(textField().value).toBe('01.03.2023')
    })

    it('closes and blurs with the picked day already in the model', async () => {
      const { events } = mountPicker(MARCH_DAY, dateProps)
      await openCalendar()

      dayButton(18)!.click()
      await flushPromises()

      expect([...new Set(events.closedWith)]).toEqual(['2023-03-18T00:00:00.000000Z'])
      // Focus moving onto the day blurs the field before anything is picked; the closing blur must not.
      expect(events.blurredWith.at(-1)).toBe('2023-03-18T00:00:00.000000Z')
    })

    describe('with a pinned clock', () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      // Only Date is faked: flushPromises schedules on a real timer.
      const pinClock = (hour: number) => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 2, 15, hour, 30))
      }

      it('takes today from the local clock just after midnight', async () => {
        pinClock(0)
        const { model } = mountPicker(null, dateProps)

        await openCalendar()

        expect(model.value).toBe('2026-03-15T00:00:00.000000Z')
      })

      it('takes today from the local clock just before midnight', async () => {
        pinClock(23)
        const { model } = mountPicker(MARCH_DAY, dateProps)
        await openCalendar()

        bottomButton(0).click()
        await flushPromises()

        expect(model.value).toBe('2026-03-15T00:00:00.000000Z')
        expect(textField().value).toBe('15.03.2026')
      })
    })
  })
})
