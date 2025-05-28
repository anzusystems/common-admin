import type { OpUnitType, QUnitType } from 'dayjs'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { isNull, isUndefined } from '@/utils/common'
import { stringToInt } from '@/utils/string'
import type { DatetimeUTC, DatetimeUTCNullable } from '@/types/common'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

export const SUFFIX = '.000000Z'
const FORMAT = 'YYYY-MM-DDTHH:mm:ss'

export const DATETIME_MIN = '1970-01-01T00:00:00.000000Z'
export const DATETIME_MAX = '2100-01-01T00:00:00.000000Z'

export const dateNow = (): Date => {
  return dayjs().utc().toDate()
}

export const dateTimeToDate = (isoDate: DatetimeUTC | DatetimeUTCNullable | string): Date => {
  return dayjs(isoDate).toDate()
}
export const timestampCurrent = (): number => {
  return stringToInt(dayjs().utc().unix())
}

export const dateTimeNow = (ignoreFractionalSeconds = true, ignoreSeconds = false): string => {
  if (ignoreFractionalSeconds && !ignoreSeconds) return dayjs().utc().format('YYYY-MM-DDTHH:mm:ss') + SUFFIX
  if (ignoreFractionalSeconds && ignoreSeconds) return dayjs().utc().format('YYYY-MM-DDTHH:mm:00') + SUFFIX
  if (!ignoreFractionalSeconds && ignoreSeconds) return dayjs().utc().format('YYYY-MM-DDTHH:mm:00.SSSSSS') + 'Z'
  return dayjs().utc().format('YYYY-MM-DDTHH:mm:ss.SSSSSS') + 'Z'
}

export const dateTimeStartOfDay = (days = 0) => {
  if (days === 0) {
    return dayjs().startOf('day').utc().format(FORMAT) + SUFFIX
  }
  return dayjs().add(days, 'days').startOf('day').utc().format(FORMAT) + SUFFIX
}

export const dateTimeEndOfDay = (days = 0) => {
  if (days === 0) {
    return dayjs().endOf('day').utc().format(FORMAT) + SUFFIX
  }
  return dayjs().add(days, 'days').endOf('day').utc().format(FORMAT) + SUFFIX
}

export const dateModifyMinutes = (minutes = 0, date: null | Date = null): Date => {
  if (date === null) date = new Date()
  if (minutes === 0) return date
  if (minutes > 0) return dayjs(date).add(minutes, 'minutes').toDate()
  if (minutes < 0) return dayjs(date).subtract(Math.abs(minutes), 'minutes').toDate()
  return date
}

export const dateToUtc = (date: dayjs.ConfigType) => {
  return dayjs(date).utc().format('YYYY-MM-DDTHH:mm:ss') + SUFFIX
}

export const yearNow = () => {
  return dayjs().utc().format('YYYY')
}

export const dateTimePretty = (
  isoDate: DatetimeUTC | DatetimeUTCNullable | string | null,
  edgeDateValue = '',
  showSeconds = false
): string => {
  if (isoDate === DATETIME_MAX || isoDate === DATETIME_MIN || isoDate === '' || isNull(isoDate) || isUndefined(isoDate))
    return edgeDateValue
  return dayjs(isoDate).format(showSeconds ? 'DD.MM.YYYY HH:mm:ss' : 'DD.MM.YYYY HH:mm')
}

export const dateTimeFriendly = (
  isoDate: DatetimeUTC | DatetimeUTCNullable | string | null,
  edgeDateValue = '',
  showSeconds = false
) => {
  if (
    isoDate === DATETIME_MAX ||
    isoDate === DATETIME_MIN ||
    isoDate === '' ||
    isNull(isoDate) ||
    isUndefined(isoDate)
  ) {
    return edgeDateValue
  }
  let displayYear = true
  let displayDayMonth = true
  const date = dayjs(isoDate)
  const now = dayjs()
  if (now.format('YYYY') === date.format('YYYY')) {
    displayYear = false
  }
  if (now.format('YYYY-MM-DD') === date.format('YYYY-MM-DD')) {
    displayDayMonth = false
  }
  if (!displayYear && !displayDayMonth) return dayjs(date).format(showSeconds ? 'H:mm:ss' : 'H:mm')
  if (!displayYear) return dayjs(date).format(showSeconds ? 'D.M. H:mm:ss' : 'D.M. H:mm')
  return dayjs(date).format(showSeconds ? 'D.M.YYYY H:mm:ss' : 'D.M.YYYY H:mm')
}

export const datePretty = (isoDate: DatetimeUTC | DatetimeUTCNullable | string | null, edgeDateValue = ''): string => {
  if (isoDate === DATETIME_MAX || isoDate === DATETIME_MIN || isoDate === '' || isNull(isoDate) || isUndefined(isoDate))
    return edgeDateValue
  return dayjs(isoDate).format('DD.MM.YYYY')
}

export const timePretty = (isoDate: DatetimeUTC | DatetimeUTCNullable | string | null, edgeDateValue = ''): string => {
  if (isoDate === DATETIME_MAX || isoDate === DATETIME_MIN || isoDate === '' || isNull(isoDate) || isUndefined(isoDate))
    return edgeDateValue
  return dayjs(isoDate).format('HH:mm')
}

export const dateDiff = (date1: Date, date2: Date, unit: QUnitType | OpUnitType = 'ms') => {
  const date1dayjs = dayjs(date1)
  const date2dayjs = dayjs(date2)
  return date1dayjs.diff(date2dayjs, unit)
}

export const isDatetimeUTC = (value: unknown): value is DatetimeUTC => {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/.test(value)
}

type MonthIntervalUTC = { from: DatetimeUTC; until: DatetimeUTC }
type MonthIntervalDate = { from: Date; until: Date }
type GetMonthIntervalFn = {
  (
    nowDate: Date,
    returnType: 'utc',
    monthOffset?: number,
    expandToCurrentMonth?: boolean
  ): MonthIntervalUTC;
  (
    nowDate: Date,
    returnType: 'date',
    monthOffset?: number,
    expandToCurrentMonth?: boolean
  ): MonthIntervalDate;
}
const _getMonthInterval = (
  nowDate: Date,
  returnType: 'date' | 'utc',
  monthOffset: number = 0,
  expandToCurrentMonth: boolean = false
): MonthIntervalUTC | MonthIntervalDate => {
  const from = new Date(nowDate)
  from.setMonth(from.getMonth() + monthOffset)
  from.setDate(1)
  from.setHours(0, 0, 0, 0)
  const until = new Date(nowDate)
  if (expandToCurrentMonth) {
    until.setMonth(until.getMonth() + 1, 0)
  } else {
    until.setMonth(until.getMonth() + monthOffset + 1, 0)
  }
  until.setHours(23, 59, 59, 999)
  if (returnType === 'utc') {
    return {
      from: dateToUtc(from),
      until: dateToUtc(until),
    }
  }
  return { from, until }
}
export const getMonthInterval = _getMonthInterval as GetMonthIntervalFn
