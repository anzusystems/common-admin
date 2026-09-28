import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { OpUnitType, QUnitType } from 'dayjs'
import {
  DATETIME_MAX,
  DATETIME_MIN,
  dateDiff,
  type DateDiffUnit,
  dateModifyMinutes,
  datePretty,
  dateTimeEndOfDay,
  dateTimeFriendly,
  dateTimeNow,
  dateTimePretty,
  dateTimeStartOfDay,
  dateTimeToDate,
  dateToUtc,
  dateUtcPretty,
  dateUtcToday,
  getMonthInterval,
  isDatetimeUTC,
  timePretty,
} from '@/utils/datetime'

/**
 * Runs in Europe/Bratislava and again in America/New_York (see vitest.config.mts). Instants are
 * written in UTC; where the answer depends on the zone, `byZone` holds one per zone. The dates
 * are the 2026 DST switches: EU 29 Mar / 25 Oct at 01:00Z, US 8 Mar / 1 Nov.
 */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const byZone = <T>(values: { 'Europe/Bratislava': T; 'America/New_York': T }): T => {
  if (!(ZONE in values)) throw new Error(`No expectation for time zone ${ZONE}`)
  return values[ZONE as keyof typeof values]
}

const setNow = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

const local = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]

afterEach(() => {
  vi.useRealTimers()
})

describe('utils/datetime', () => {
  describe('dateTimeNow', () => {
    it('formats now in UTC with the API suffix', () => {
      setNow('2026-09-25T10:11:12.345Z')
      expect(dateTimeNow()).toBe('2026-09-25T10:11:12.000000Z')
      expect(dateTimeNow(true, true)).toBe('2026-09-25T10:11:00.000000Z')
    })

    // dayjs has no six-digit token: `SSSSSS` is `SSS` twice, so 345 ms printed as 345345 us.
    it('prints the fraction as microseconds', () => {
      setNow('2026-09-25T10:11:12.345Z')
      expect(dateTimeNow(false)).toBe('2026-09-25T10:11:12.345000Z')
      expect(dateTimeNow(false, true)).toBe('2026-09-25T10:11:00.345000Z')
    })
  })

  describe('dateTimeStartOfDay / dateTimeEndOfDay', () => {
    it('answers the local day as UTC instants', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeStartOfDay()).toBe(
        byZone({
          'Europe/Bratislava': '2026-09-24T22:00:00.000000Z',
          'America/New_York': '2026-09-25T04:00:00.000000Z',
        })
      )
      expect(dateTimeEndOfDay()).toBe(
        byZone({
          'Europe/Bratislava': '2026-09-25T21:59:59.000000Z',
          'America/New_York': '2026-09-26T03:59:59.000000Z',
        })
      )
    })

    it('uses the local date just after local midnight', () => {
      setNow('2026-09-25T22:30:00Z')
      expect(dateTimeStartOfDay()).toBe(
        byZone({
          'Europe/Bratislava': '2026-09-25T22:00:00.000000Z',
          'America/New_York': '2026-09-25T04:00:00.000000Z',
        })
      )
    })

    it('spans the 23-hour spring-forward day', () => {
      setNow('2026-03-29T10:00:00Z')
      expect(dateTimeStartOfDay()).toBe(
        byZone({
          'Europe/Bratislava': '2026-03-28T23:00:00.000000Z',
          'America/New_York': '2026-03-29T04:00:00.000000Z',
        })
      )
      expect(dateTimeEndOfDay()).toBe(
        byZone({
          'Europe/Bratislava': '2026-03-29T21:59:59.000000Z',
          'America/New_York': '2026-03-30T03:59:59.000000Z',
        })
      )
    })

    it('offsets by calendar days across a DST switch', () => {
      setNow('2026-03-30T10:00:00Z')
      expect(dateTimeStartOfDay(-1)).toBe(
        byZone({
          'Europe/Bratislava': '2026-03-28T23:00:00.000000Z',
          'America/New_York': '2026-03-29T04:00:00.000000Z',
        })
      )
      setNow('2026-10-24T10:00:00Z')
      expect(dateTimeStartOfDay(1)).toBe(
        byZone({
          'Europe/Bratislava': '2026-10-24T22:00:00.000000Z',
          'America/New_York': '2026-10-25T04:00:00.000000Z',
        })
      )
      expect(dateTimeEndOfDay(1)).toBe(
        byZone({
          'Europe/Bratislava': '2026-10-25T22:59:59.000000Z',
          'America/New_York': '2026-10-26T03:59:59.000000Z',
        })
      )
    })

    // The admins' filter default: `dateTimeStartOfDay(-365)`.
    it('reaches a year back', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeStartOfDay(-365)).toBe(
        byZone({
          'Europe/Bratislava': '2025-09-24T22:00:00.000000Z',
          'America/New_York': '2025-09-25T04:00:00.000000Z',
        })
      )
    })

    it('counts 366 days back across a leap day', () => {
      setNow('2028-03-01T10:00:00Z')
      expect(dateTimeStartOfDay(-1)).toBe(
        byZone({
          'Europe/Bratislava': '2028-02-28T23:00:00.000000Z',
          'America/New_York': '2028-02-29T05:00:00.000000Z',
        })
      )
    })
  })

  describe('dateUtcToday', () => {
    it('is UTC midnight of the local date', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateUtcToday()).toBe('2026-09-25T00:00:00.000000Z')
    })

    it('follows the local date, not the UTC one, near midnight', () => {
      setNow('2026-09-25T22:30:00Z')
      expect(dateUtcToday()).toBe(
        byZone({
          'Europe/Bratislava': '2026-09-26T00:00:00.000000Z',
          'America/New_York': '2026-09-25T00:00:00.000000Z',
        })
      )
      setNow('2026-09-26T02:30:00Z')
      expect(dateUtcToday()).toBe(
        byZone({
          'Europe/Bratislava': '2026-09-26T00:00:00.000000Z',
          'America/New_York': '2026-09-25T00:00:00.000000Z',
        })
      )
    })

    it('keeps a leap day', () => {
      setNow('2028-02-29T12:00:00Z')
      expect(dateUtcToday()).toBe('2028-02-29T00:00:00.000000Z')
    })
  })

  describe('dateToUtc', () => {
    it('keeps the instant of a Date and drops the milliseconds', () => {
      expect(dateToUtc(new Date('2026-10-25T01:30:45.987Z'))).toBe('2026-10-25T01:30:45.000000Z')
    })

    it('accepts a timestamp (admin-cms passes `now.setDate(...)`)', () => {
      expect(dateToUtc(Date.UTC(2026, 1, 28, 12))).toBe('2026-02-28T12:00:00.000000Z')
    })

    it('takes a custom suffix', () => {
      expect(dateToUtc(new Date('2026-01-01T00:00:00Z'), 'Z')).toBe('2026-01-01T00:00:00Z')
    })

    it('reads a zone-less string as local time', () => {
      expect(dateToUtc('2026-07-01T12:00:00')).toBe(
        byZone({
          'Europe/Bratislava': '2026-07-01T10:00:00.000000Z',
          'America/New_York': '2026-07-01T16:00:00.000000Z',
        })
      )
    })

    // A wall-clock time the spring-forward skips moves forward an hour, as Date does.
    it('moves a skipped local time forward', () => {
      expect(dateToUtc('2026-03-29T02:30:00')).toBe(
        byZone({
          'Europe/Bratislava': '2026-03-29T01:30:00.000000Z',
          'America/New_York': '2026-03-29T06:30:00.000000Z',
        })
      )
    })
  })

  describe('dateTimeToDate', () => {
    it('parses the API format with six fraction digits', () => {
      expect(dateTimeToDate('2026-03-29T01:00:00.000000Z').toISOString()).toBe('2026-03-29T01:00:00.000Z')
      expect(dateTimeToDate('2026-03-29T01:00:00.123456Z').toISOString()).toBe('2026-03-29T01:00:00.123Z')
    })

    it('answers an invalid Date for an absent value', () => {
      expect(Number.isNaN(dateTimeToDate(null).getTime())).toBe(true)
      expect(Number.isNaN(dateTimeToDate('').getTime())).toBe(true)
    })
  })

  describe('dateModifyMinutes', () => {
    it('adds and subtracts real minutes across a DST switch', () => {
      const before = new Date('2026-03-29T00:30:00Z')
      expect(dateModifyMinutes(60, before).toISOString()).toBe('2026-03-29T01:30:00.000Z')
      expect(dateModifyMinutes(-60, new Date('2026-10-25T01:30:00Z')).toISOString()).toBe('2026-10-25T00:30:00.000Z')
    })

    it('handles fractional minutes (the timeline passes seconds / 60)', () => {
      expect(dateModifyMinutes(1.5, new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-01T00:01:30.000Z')
    })

    it('returns the same Date for zero and NaN', () => {
      const date = new Date('2026-01-01T00:00:00Z')
      expect(dateModifyMinutes(0, date)).toBe(date)
      expect(dateModifyMinutes(NaN, date)).toBe(date)
    })

    it('does not mutate the given Date', () => {
      const date = new Date('2026-01-01T00:00:00Z')
      dateModifyMinutes(30, date)
      expect(date.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    })

    it('defaults to now', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateModifyMinutes(5).toISOString()).toBe('2026-09-25T10:05:00.000Z')
    })
  })

  describe('dateDiff', () => {
    it('defaults to milliseconds and is signed', () => {
      const a = new Date('2026-01-01T00:00:01Z')
      const b = new Date('2026-01-01T00:00:00Z')
      expect(dateDiff(a, b)).toBe(1000)
      expect(dateDiff(b, a)).toBe(-1000)
      expect(dateDiff(a, b, 'seconds')).toBe(1)
    })

    it('truncates towards zero', () => {
      expect(dateDiff(new Date('2026-01-01T00:00:59Z'), new Date('2026-01-01T00:00:00Z'), 'minutes')).toBe(0)
    })

    it('counts local calendar days, so the 23-hour day is one day', () => {
      const monday = new Date('2026-03-29T22:00:00Z')
      const sunday = new Date('2026-03-28T23:00:00Z')
      expect(dateDiff(monday, sunday, 'days')).toBe(byZone({ 'Europe/Bratislava': 1, 'America/New_York': 0 }))
    })
  })

  describe('pretty printers', () => {
    it('print the local wall-clock time around the spring-forward', () => {
      expect(dateTimePretty('2026-03-29T00:59:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '29.03.2026 01:59', 'America/New_York': '28.03.2026 20:59' })
      )
      expect(dateTimePretty('2026-03-29T01:00:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '29.03.2026 03:00', 'America/New_York': '28.03.2026 21:00' })
      )
    })

    it('print the repeated hour of the fall-back twice', () => {
      expect(dateTimePretty('2026-10-25T00:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '25.10.2026 02:30', 'America/New_York': '24.10.2026 20:30' })
      )
      expect(dateTimePretty('2026-10-25T01:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '25.10.2026 02:30', 'America/New_York': '24.10.2026 21:30' })
      )
      expect(dateTimePretty('2026-11-01T05:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '01.11.2026 06:30', 'America/New_York': '01.11.2026 01:30' })
      )
      expect(dateTimePretty('2026-11-01T06:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '01.11.2026 07:30', 'America/New_York': '01.11.2026 01:30' })
      )
    })

    it('show seconds on request', () => {
      expect(dateTimePretty('2026-07-01T10:00:05.000000Z', '', true)).toBe(
        byZone({ 'Europe/Bratislava': '01.07.2026 12:00:05', 'America/New_York': '01.07.2026 06:00:05' })
      )
    })

    it('answer the edge value for the bounds and absent values', () => {
      for (const fn of [dateTimePretty, datePretty, dateUtcPretty, timePretty, dateTimeFriendly]) {
        expect(fn(DATETIME_MAX, '-')).toBe('-')
        expect(fn(DATETIME_MIN, '-')).toBe('-')
        expect(fn(null, '-')).toBe('-')
        expect(fn('', '-')).toBe('-')
        expect(fn(undefined as unknown as null, '-')).toBe('-')
        expect(fn(null)).toBe('')
      }
    })

    it('tell a stored calendar day from an instant', () => {
      // `dateUtcPretty` reads the day the API stores; `datePretty` the local day of the instant.
      expect(dateUtcPretty('2026-03-29T00:00:00.000000Z')).toBe('29.03.2026')
      expect(datePretty('2026-03-29T00:00:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '29.03.2026', 'America/New_York': '28.03.2026' })
      )
      expect(dateUtcPretty('2028-02-29T00:00:00.000000Z')).toBe('29.02.2028')
    })

    it('print the local time', () => {
      expect(timePretty('2026-10-25T01:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '02:30', 'America/New_York': '21:30' })
      )
    })

    // Documented: the bounds are matched verbatim, so a bound spelled without the fraction prints
    // as a date.
    it('match the bounds verbatim', () => {
      expect(dateUtcPretty('2100-01-01T00:00:00Z')).toBe('01.01.2100')
    })
  })

  describe('dateTimeFriendly', () => {
    it('shows only the time for today', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeFriendly('2026-09-25T08:05:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '10:05', 'America/New_York': '4:05' })
      )
      expect(dateTimeFriendly('2026-09-25T08:05:09.000000Z', '', true)).toBe(
        byZone({ 'Europe/Bratislava': '10:05:09', 'America/New_York': '4:05:09' })
      )
    })

    it('drops the year within the current year', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeFriendly('2026-03-01T08:05:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '1.3. 9:05', 'America/New_York': '1.3. 3:05' })
      )
    })

    it('decides today and this year by the local date', () => {
      setNow('2026-01-01T10:00:00Z')
      expect(dateTimeFriendly('2025-12-31T23:30:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '0:30', 'America/New_York': '31.12.2025 18:30' })
      )
    })

    it('shows the full date for another year', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeFriendly('2024-02-29T12:00:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '29.2.2024 13:00', 'America/New_York': '29.2.2024 7:00' })
      )
    })

    it('treats the same day and month of another year as another year', () => {
      setNow('2026-09-25T10:00:00Z')
      expect(dateTimeFriendly('2025-09-25T10:00:00.000000Z')).toBe(
        byZone({ 'Europe/Bratislava': '25.9.2025 12:00', 'America/New_York': '25.9.2025 6:00' })
      )
    })
  })

  describe('isDatetimeUTC', () => {
    it('accepts the API shapes', () => {
      expect(isDatetimeUTC('2026-09-25T10:00:00.000000Z')).toBe(true)
      expect(isDatetimeUTC('2026-09-25T10:00:00.123Z')).toBe(true)
      expect(isDatetimeUTC('2026-09-25T10:00:00Z')).toBe(true)
    })

    it('rejects other shapes and types', () => {
      expect(isDatetimeUTC('2026-09-25T10:00:00+00:00')).toBe(false)
      expect(isDatetimeUTC('2026-09-25T10:00:00.1234567Z')).toBe(false)
      expect(isDatetimeUTC('2026-09-25T10:00:00.12Z')).toBe(false)
      expect(isDatetimeUTC('2026-09-25')).toBe(false)
      expect(isDatetimeUTC('2026-09-25 10:00:00Z')).toBe(false)
      expect(isDatetimeUTC(null)).toBe(false)
      expect(isDatetimeUTC(Date.now())).toBe(false)
    })

    // Documented: it is a shape check, not a calendar check.
    it('does not validate the calendar', () => {
      expect(isDatetimeUTC('2026-02-30T25:61:61Z')).toBe(true)
    })
  })

  describe('getMonthInterval', () => {
    it('spans the current month', () => {
      const { from, until } = getMonthInterval(new Date(2026, 8, 25, 12), 'date')
      expect(local(from)).toEqual([2026, 9, 1])
      expect([from.getHours(), from.getMinutes(), from.getSeconds()]).toEqual([0, 0, 0])
      expect(local(until)).toEqual([2026, 9, 30])
      expect([until.getHours(), until.getMinutes(), until.getSeconds(), until.getMilliseconds()]).toEqual([
        23, 59, 59, 999,
      ])
    })

    it('spans the previous month', () => {
      const { from, until } = getMonthInterval(new Date(2026, 8, 25, 12), 'date', -1)
      expect(local(from)).toEqual([2026, 8, 1])
      expect(local(until)).toEqual([2026, 8, 31])
    })

    it('spans a leap February', () => {
      const { from, until } = getMonthInterval(new Date(2028, 2, 15, 12), 'date', -1)
      expect(local(from)).toEqual([2028, 2, 1])
      expect(local(until)).toEqual([2028, 2, 29])
    })

    it('crosses the year boundary', () => {
      const { from, until } = getMonthInterval(new Date(2026, 0, 15, 12), 'date', -1)
      expect(local(from)).toEqual([2025, 12, 1])
      expect(local(until)).toEqual([2025, 12, 31])
    })

    // The "last month" filter option on the last days of a month: setting the month first lets a
    // missing day (31 Feb) roll over into the next month before the day is reset to the 1st.
    it('spans the previous month on the 31st', () => {
      const { from, until } = getMonthInterval(new Date(2026, 2, 31, 12), 'date', -1)
      expect(local(from)).toEqual([2026, 2, 1])
      expect(local(until)).toEqual([2026, 2, 28])
      const july = getMonthInterval(new Date(2026, 6, 31, 12), 'date', -1)
      expect(local(july.from)).toEqual([2026, 6, 1])
      expect(local(july.until)).toEqual([2026, 6, 30])
    })

    it('spans three months on the 30th ("last 3 months")', () => {
      const { from, until } = getMonthInterval(new Date(2026, 3, 30, 12), 'date', -2, true)
      expect(local(from)).toEqual([2026, 2, 1])
      expect(local(until)).toEqual([2026, 4, 30])
    })

    it('spans a later month on the 31st', () => {
      const { from, until } = getMonthInterval(new Date(2026, 0, 31, 12), 'date', 1)
      expect(local(from)).toEqual([2026, 2, 1])
      expect(local(until)).toEqual([2026, 2, 28])
    })

    it('never answers an inverted interval', () => {
      for (let month = 0; month < 12; month++) {
        for (const day of [28, 29, 30, 31]) {
          const now = new Date(2026, month, day, 12)
          if (now.getMonth() !== month) continue
          for (const offset of [-2, -1, 0, 1]) {
            const { from, until } = getMonthInterval(now, 'date', offset)
            expect(from < until, `${now.toDateString()} offset ${offset}`).toBe(true)
            expect(from.getDate()).toBe(1)
          }
        }
      }
    })

    it('answers the local month bounds as UTC strings', () => {
      const interval = getMonthInterval(new Date(2026, 2, 15, 12), 'utc')
      expect(interval).toEqual(
        byZone({
          'Europe/Bratislava': { from: '2026-02-28T23:00:00.000000Z', until: '2026-03-31T21:59:59.000000Z' },
          'America/New_York': { from: '2026-03-01T05:00:00.000000Z', until: '2026-04-01T03:59:59.000000Z' },
        })
      )
    })

    it('does not mutate the given Date', () => {
      const now = new Date(2026, 2, 31, 12)
      getMonthInterval(now, 'date', -1)
      expect(local(now)).toEqual([2026, 3, 31])
    })
  })
})

// The public signatures no longer expose dayjs types; every unit accepted is one dayjs understands.
describe('date helper signatures', () => {
  it('dateDiff takes its own unit union, which dayjs understands', () => {
    expectTypeOf<Parameters<typeof dateDiff>[2]>().toEqualTypeOf<DateDiffUnit | undefined>()
    expectTypeOf<DateDiffUnit>().toExtend<QUnitType | OpUnitType>()
    expect(dateDiff(new Date('2026-01-03'), new Date('2026-01-01'), 'days')).toBe(2)
    expect(dateDiff(new Date('2026-01-01T00:02:00Z'), new Date('2026-01-01T00:00:00Z'), 'm')).toBe(2)
  })

  it('dateToUtc takes a Date, a date string or a timestamp', () => {
    expectTypeOf<Parameters<typeof dateToUtc>[0]>().toEqualTypeOf<Date | string | number>()
  })
})
