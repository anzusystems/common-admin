import { useI18n } from 'vue-i18n'

const MINUTE_IN_SECONDS = 60
const HOUR_IN_SECONDS = 3600
const DAY_IN_SECONDS = 86400

export function useRemainingTime() {
  const { t } = useI18n()

  const remainingTime = (seconds: number, short: boolean): string => {
    const prefix = short ? 'common.time.short.' : 'common.time.long.'
    if (seconds > DAY_IN_SECONDS) {
      return t(prefix + 'remainingDays', { value: Math.floor(seconds / DAY_IN_SECONDS) })
    }
    if (seconds > HOUR_IN_SECONDS) {
      return t(prefix + 'remainingHours', { value: Math.floor(seconds / HOUR_IN_SECONDS) })
    }
    if (seconds > MINUTE_IN_SECONDS) {
      return t(prefix + 'remainingMinutes', { value: Math.floor(seconds / MINUTE_IN_SECONDS) })
    }
    return t(prefix + 'remainingSeconds', { value: seconds })
  }

  const remainingTimeShort = (seconds: number): string => {
    return remainingTime(seconds, true)
  }

  const remainingTimeLong = (seconds: number): string => {
    return remainingTime(seconds, false)
  }

  return {
    remainingTimeShort,
    remainingTimeLong,
  }
}
