import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { isNull, isUndefined } from '@/shared/utils/common'
import { SUFFIX } from '@/shared/utils/datetime'
import type { DatetimeUTC } from '@/shared/types/common'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

/**
 * Value arithmetic of ADatetimePicker, kept out of the component so both modes are testable without a DOM.
 * `datetime` values are instants: parsed as such, shown in local time, serialized through `.utc()`.
 * `date` values are calendar days pinned to UTC midnight and must never cross a timezone. Every internal
 * object stays in UTC mode, so `.year()/.month()/.date()` and `.format()` read the day the API stores.
 */
export type DatetimePickerType = 'datetime' | 'date'

const MODEL_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ'
const SERIALIZE_FORMAT = 'YYYY-MM-DDTHH:mm:ss'
const DATE_TEXT_FORMAT = 'DD.MM.YYYY'
const DATETIME_TEXT_FORMATS = ['DD.MM.YYYY HH:mm', DATE_TEXT_FORMAT]

export const placeholderFor = (type: DatetimePickerType) => (type === 'date' ? 'dd.mm.yyyy' : 'dd.mm.yyyy hh:mm')

export const displayFormatFor = (type: DatetimePickerType) => (type === 'date' ? DATE_TEXT_FORMAT : 'DD.MM.YYYY HH:mm')

export const parseModel = (
  value: DatetimeUTC | null | undefined,
  type: DatetimePickerType,
  lastMinuteMoment = false
): dayjs.Dayjs | null => {
  // `dayjs.utc(undefined)` is now, not Invalid.
  if (isNull(value) || isUndefined(value) || value.length === 0) return null
  if (type === 'date') {
    const parsed = dayjs.utc(value)
    return parsed.isValid() ? parsed : null
  }
  // The canonical shape has six fraction digits, but `isDatetimeUTC` also accepts three and an API can send none.
  // Returning null for those would blank the field and save the blank.
  const parsed = dayjs(value, MODEL_FORMAT)
  const instant = parsed.isValid() ? parsed : dayjs(value)
  if (!instant.isValid()) return null
  return lastMinuteMoment ? instant.millisecond(999) : instant.millisecond(0)
}

export const parseTyped = (text: string, type: DatetimePickerType, keepSeconds = 0): dayjs.Dayjs | null => {
  if (type === 'date') {
    // The format must stay a string. With an array, `dayjs.utc(text,
    // [format])` goes through customParseFormat's plain factory and drops UTC.
    // A typed day then shifts by the local offset. `dayjs(text, [format]).utc()` shifts it too.
    const parsed = dayjs.utc(text, DATE_TEXT_FORMAT)
    return parsed.isValid() ? parsed : null
  }
  const parsed = dayjs(text, DATETIME_TEXT_FORMATS)
  return parsed.isValid() ? parsed.second(keepSeconds) : null
}

export const serialize = (internal: dayjs.Dayjs, type: DatetimePickerType): DatetimeUTC => {
  if (type === 'date') return internal.format('YYYY-MM-DD') + 'T00:00:00' + SUFFIX
  return internal.utc().format(SERIALIZE_FORMAT) + SUFFIX
}

export const formatDisplay = (internal: dayjs.Dayjs, type: DatetimePickerType) =>
  internal.format(displayFormatFor(type))

/**
 * VDatePicker works with local `Date`s, so a date-mode day travels as its local namesake.
 */
export const toCalendarDate = (internal: dayjs.Dayjs, type: DatetimePickerType): Date =>
  type === 'date' ? new Date(internal.year(), internal.month(), internal.date()) : internal.toDate()

export const applyCalendarDate = (internal: dayjs.Dayjs, picked: Date, type: DatetimePickerType): dayjs.Dayjs => {
  if (type === 'date') {
    return dayjs.utc(Date.UTC(picked.getFullYear(), picked.getMonth(), picked.getDate()))
  }
  // Set year and month first. Setting a day onto a shorter month overflows: 8
  // Feb + day 31 becomes 3 Mar, and the month set then moves it to January.
  return internal.set('year', picked.getFullYear()).set('month', picked.getMonth()).set('date', picked.getDate())
}

/**
 * Today's calendar day from the local clock. For part of the day the UTC day is yesterday or tomorrow.
 */
export const todayValue = (type: DatetimePickerType, lastMinuteMoment = false): dayjs.Dayjs => {
  if (type === 'date') {
    const now = new Date()
    return dayjs.utc(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  }
  return lastMinuteMoment ? dayjs().second(59).millisecond(999) : dayjs().second(0).millisecond(0)
}

/**
 * Base for a picker interaction that starts with no value at all.
 */
export const emptyBaseValue = (type: DatetimePickerType, lastMinuteMoment = false): dayjs.Dayjs => {
  if (type === 'date') return todayValue(type)
  return lastMinuteMoment
    ? dayjs().hour(0).minute(0).second(59).millisecond(999)
    : dayjs().hour(0).minute(0).second(0).millisecond(0)
}

/**
 * By second, as `lastMinuteMoment` holds ms at 999; by day where the time carries no meaning.
 */
export const isSameValue = (value: dayjs.Dayjs, other: dayjs.Dayjs | null, type: DatetimePickerType): boolean =>
  isNull(other) ? false : value.isSame(other, type === 'date' ? 'day' : 'second')
