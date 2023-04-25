import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { isNull, isUndefined } from '@/utils/common'
import { stringToInt } from '@/utils/string'
import type { DatetimeUTC, DatetimeUTCNullable } from '@/types/common'

dayjs.extend(utc)

const SUFFIX = '.000000Z'
const FORMAT = 'YYYY-MM-DDTHH:mm:ss'

export const DATETIME_MIN = '1970-01-01T00:00:00.000000Z'
export const DATETIME_MAX = '2100-01-01T00:00:00.000000Z'

export const dateNow = (): Date => {
  return dayjs().utc().toDate()
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
  if (minutes < 0) return dayjs(date).subtract(minutes, 'minutes').toDate()
}

export const dateToUtc = (date: dayjs.ConfigType) => {
  return dayjs(date).utc().format('YYYY-MM-DDTHH:mm:ss') + SUFFIX
}

export const yearNow = () => {
  return dayjs().utc().format('YYYY')
}

export const dateTimePretty = (
  isoDate: DatetimeUTC | DatetimeUTCNullable | string | null,
  edgeDateValue = ''
): string => {
  if (isoDate === DATETIME_MAX || isoDate === DATETIME_MIN || isoDate === '' || isNull(isoDate) || isUndefined(isoDate))
    return edgeDateValue
  return dayjs(isoDate).format('DD.MM.YYYY HH:mm')
}

export const dateTimeFriendly = (isoDate: DatetimeUTC | DatetimeUTCNullable | string | null, edgeDateValue = '') => {
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
  if (!displayYear && !displayDayMonth) return dayjs(date).format('H:mm')
  if (!displayYear) return dayjs(date).format('D.M. H:mm')
  return dayjs(date).format('D.M.YYYY H:mm')
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

export const dateDiff = (isoDate1: Date, isoDate2: Date) => {
  const date1 = dayjs(isoDate1)
  const date2 = dayjs(isoDate2)
  return date1.diff(date2)
}
