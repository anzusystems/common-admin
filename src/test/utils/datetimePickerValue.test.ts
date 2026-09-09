import { afterEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import {
  applyCalendarDate,
  displayFormatFor,
  emptyBaseValue,
  formatDisplay,
  isSameValue,
  parseModel,
  parseTyped,
  placeholderFor,
  serialize,
  toCalendarDate,
  todayValue,
} from '@/utils/datetimePickerValue'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

/**
 * Everything here is timezone-sensitive by design; the suite runs in Europe/Bratislava and in
 * America/New_York, and the date-mode expectations must hold identically in both.
 */

const FEBRUARY_2023 = '2023-02-08T08:17:29.000000Z'
const SEPTEMBER_DAY = '2026-09-08T00:00:00.000000Z'

describe('datetimePickerValue', () => {
  describe('formats', () => {
    it('drops the time from the date-mode display format and placeholder', () => {
      expect(displayFormatFor('date')).toBe('DD.MM.YYYY')
      expect(placeholderFor('date')).toBe('dd.mm.yyyy')
      expect(displayFormatFor('datetime')).toBe('DD.MM.YYYY HH:mm')
      expect(placeholderFor('datetime')).toBe('dd.mm.yyyy hh:mm')
    })
  })

  describe('parseModel', () => {
    it('reads a date value as the day the API stores', () => {
      const parsed = parseModel(SEPTEMBER_DAY, 'date')!

      expect(parsed.date()).toBe(8)
      expect(parsed.month()).toBe(8)
      expect(parsed.year()).toBe(2026)
      expect(formatDisplay(parsed, 'date')).toBe('08.09.2026')
    })

    it('returns null for an absent value instead of now', () => {
      expect(parseModel(null, 'date')).toBeNull()
      expect(parseModel(undefined, 'date')).toBeNull()
      expect(parseModel('', 'date')).toBeNull()
      expect(parseModel(null, 'datetime')).toBeNull()
      expect(parseModel(undefined, 'datetime')).toBeNull()
    })

    it('reads a value whose fraction is not six digits', () => {
      // `isDatetimeUTC` accepts three digits and an API can answer with none; blanking the field
      // would write the blank back.
      for (const value of [
        '2023-02-08T08:17:29.123Z',
        '2023-02-08T08:17:29Z',
        '2023-02-08T08:17:29+00:00',
      ]) {
        expect(serialize(parseModel(value, 'datetime')!, 'datetime')).toBe(FEBRUARY_2023)
      }
      expect(parseModel('nonsense', 'datetime')).toBeNull()
      expect(parseModel('nonsense', 'date')).toBeNull()
    })

    it('keeps the instant in datetime mode', () => {
      const parsed = parseModel(FEBRUARY_2023, 'datetime')!

      expect(parsed.valueOf()).toBe(dayjs(FEBRUARY_2023).valueOf())
      expect(parsed.millisecond()).toBe(0)
      expect(parseModel(FEBRUARY_2023, 'datetime', true)!.millisecond()).toBe(999)
    })
  })

  describe('parseTyped', () => {
    it('turns a typed day into UTC midnight of that day', () => {
      expect(serialize(parseTyped('08.09.2026', 'date')!, 'date')).toBe(SEPTEMBER_DAY)
    })

    it('ignores a time typed into a date field', () => {
      expect(serialize(parseTyped('08.09.2026 10:30', 'date')!, 'date')).toBe(SEPTEMBER_DAY)
    })

    it('rejects what it cannot read', () => {
      expect(parseTyped('..', 'date')).toBeNull()
      expect(parseTyped('..', 'datetime')).toBeNull()
    })

    it('does not go through the local-time parse that shifted the day', () => {
      // Both spellings of the mistake: the array branch of customParseFormat drops UTC, and
      // parsing locally then converting keeps the local midnight instant.
      // @ts-expect-error the array form is not in dayjs.utc's typing - which is the first guard
      const viaArray = dayjs.utc('08.09.2026', ['DD.MM.YYYY'])
      const viaConversion = dayjs('08.09.2026', ['DD.MM.YYYY']).utc()
      const correct = parseTyped('08.09.2026', 'date')!

      // By instant, not by day: west of Greenwich the wrong parse lands at 04:00 on the right
      // day, so a day-level assertion would pass there.
      expect(serialize(correct, 'date')).toBe(SEPTEMBER_DAY)
      expect(correct.toISOString()).toBe('2026-09-08T00:00:00.000Z')
      if (dayjs().utcOffset() !== 0) {
        expect(viaArray.toISOString()).not.toBe(correct.toISOString())
        expect(viaConversion.toISOString()).not.toBe(correct.toISOString())
      }
    })

    it('keeps the seconds of the model in datetime mode', () => {
      expect(parseTyped('05.05.2025 10:00', 'datetime', 29)!.second()).toBe(29)
    })
  })

  describe('serialize', () => {
    it('pins a date value to UTC midnight', () => {
      expect(serialize(parseModel(SEPTEMBER_DAY, 'date')!, 'date')).toBe(SEPTEMBER_DAY)
    })

    it('normalises a stored value that carries a time', () => {
      const withTime = parseModel('2026-09-08T12:00:00.000000Z', 'date')!

      expect(serialize(withTime, 'date')).toBe(SEPTEMBER_DAY)
      expect(formatDisplay(withTime, 'date')).toBe('08.09.2026')
    })

    it('converts to UTC in datetime mode', () => {
      expect(serialize(parseModel(FEBRUARY_2023, 'datetime')!, 'datetime')).toBe(FEBRUARY_2023)
    })
  })

  describe('calendar', () => {
    it('hands VDatePicker the same day it will show', () => {
      const asDate = toCalendarDate(parseModel(SEPTEMBER_DAY, 'date')!, 'date')

      expect(asDate.getFullYear()).toBe(2026)
      expect(asDate.getMonth()).toBe(8)
      expect(asDate.getDate()).toBe(8)
    })

    it('takes the picked day back as UTC midnight', () => {
      const internal = parseModel(SEPTEMBER_DAY, 'date')!
      const picked = new Date(2026, 8, 21)

      expect(serialize(applyCalendarDate(internal, picked, 'date'), 'date')).toBe(
        '2026-09-21T00:00:00.000000Z',
      )
    })

    it('applies a day of an adjacent shorter month without overflowing', () => {
      const internal = parseModel(FEBRUARY_2023, 'datetime')!
      const picked = new Date(2023, 0, 31)

      const applied = applyCalendarDate(internal, picked, 'datetime')

      expect(applied.format('DD.MM.YYYY')).toBe('31.01.2023')
      expect(applied.format('HH:mm:ss')).toBe(internal.format('HH:mm:ss'))
    })

    it('applies a day of an adjacent month in date mode too', () => {
      const internal = parseModel('2023-02-08T00:00:00.000000Z', 'date')!
      const picked = new Date(2023, 0, 31)

      expect(serialize(applyCalendarDate(internal, picked, 'date'), 'date')).toBe(
        '2023-01-31T00:00:00.000000Z',
      )
    })
  })

  describe('today', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const pinClock = (hour: number) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 2, 15, hour, 30))
    }

    // Outside these two windows the local and the UTC day agree and a UTC-day implementation passes.
    it('is the local calendar day just after midnight', () => {
      pinClock(0)

      expect(serialize(todayValue('date'), 'date')).toBe('2026-03-15T00:00:00.000000Z')
      expect(serialize(emptyBaseValue('date'), 'date')).toBe('2026-03-15T00:00:00.000000Z')
    })

    it('is the local calendar day just before midnight', () => {
      pinClock(23)

      expect(serialize(todayValue('date'), 'date')).toBe('2026-03-15T00:00:00.000000Z')
    })

    it('keeps the current time in datetime mode', () => {
      pinClock(23)

      expect(todayValue('datetime').format('DD.MM.YYYY HH:mm')).toBe('15.03.2026 23:30')
      expect(todayValue('datetime', true).second()).toBe(59)
    })
  })

  describe('isSameValue', () => {
    it('compares by day in date mode', () => {
      const day = parseModel(SEPTEMBER_DAY, 'date')!
      const sameDayLater = parseModel('2026-09-08T18:00:00.000000Z', 'date')!

      expect(isSameValue(day, sameDayLater, 'date')).toBe(true)
      expect(isSameValue(day, parseModel('2026-09-09T00:00:00.000000Z', 'date'), 'date')).toBe(
        false,
      )
      expect(isSameValue(day, null, 'date')).toBe(false)
    })

    it('compares by second in datetime mode', () => {
      const value = parseModel(FEBRUARY_2023, 'datetime')!

      expect(isSameValue(value, value.millisecond(999), 'datetime')).toBe(true)
      expect(isSameValue(value, value.add(1, 'second'), 'datetime')).toBe(false)
    })
  })
})
