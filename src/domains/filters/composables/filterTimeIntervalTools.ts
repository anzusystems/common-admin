import { computed, type Ref } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { isNull, isUndefined } from '@/shared/utils/common'
import { useI18n } from 'vue-i18n'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import useVuelidate from '@vuelidate/core'
import type { DatetimeUTCNullable } from '@/shared/types/common'

/** note: number value represents time interval in minutes, null represent unselected */
export type TimeIntervalToolsValue = number | TimeIntervalSpecialOptionsType | null

export const TimeIntervalSpecialOptions = {
  CurrentMonth: 'cm',
  LastMonth: 'lm',
  Last3Months: 'l3m',
  Custom: 'custom',
} as const

export type TimeIntervalSpecialOptionsType =
  (typeof TimeIntervalSpecialOptions)[keyof typeof TimeIntervalSpecialOptions]

export function useTimeIntervalOptions(allowed: TimeIntervalToolsValue[] | undefined = undefined) {
  const { t } = useI18n()

  const timeIntervalOptions = computed<ValueObjectOption<TimeIntervalToolsValue>[]>(() => {
    const values = [
      {
        value: null,
        title: t('common.model.all'),
      },
      {
        value: 60,
        title: t('common.filter.timeInterval.options.hour1'),
      },
      {
        value: 1_440,
        title: t('common.filter.timeInterval.options.day1'),
      },
      {
        value: 10_080,
        title: t('common.filter.timeInterval.options.days7'),
      },
      {
        value: 40_320,
        title: t('common.filter.timeInterval.options.days28'),
      },
      {
        value: TimeIntervalSpecialOptions.CurrentMonth,
        title: t('common.filter.timeInterval.options.currentMonth'),
      },
      {
        value: TimeIntervalSpecialOptions.LastMonth,
        title: t('common.filter.timeInterval.options.lastMonth'),
      },
      {
        value: TimeIntervalSpecialOptions.Last3Months,
        title: t('common.filter.timeInterval.options.last3Months'),
      },
      {
        value: TimeIntervalSpecialOptions.Custom,
        title: t('common.filter.timeInterval.options.custom'),
      },
    ]
    if (isUndefined(allowed)) return values

    return values.filter((item) => allowed.includes(item.value) || isNull(item.value))
  })

  const getTimeIntervalOption = (value: TimeIntervalToolsValue) => {
    return timeIntervalOptions.value.find((item) => item.value === value)
  }

  return {
    timeIntervalOptions,
    getTimeIntervalOption,
  }
}

export function useFilterTimeIntervalValidators(
  dialogData: Ref<{
    from: DatetimeUTCNullable
    until: DatetimeUTCNullable
  }>
) {
  // const { t } = useI18n()
  const { datesCompare, required } = useValidate()

  const fromComputed = computed(() => {
    return dialogData.value.from
  })

  const untilComputed = computed(() => {
    return dialogData.value.until
  })

  const rules = {
    dialogData: {
      from: {
        required,
        datesCompare: datesCompare(untilComputed, 'Until', 'onOrBefore'),
      },
      until: {
        required,
        datesCompare: datesCompare(fromComputed, 'From', 'laterThan'),
      },
    },
  }

  const v$ = useVuelidate(rules, { dialogData }, { $scope: 'AFilterTimeIntervalScope' })

  return {
    v$,
  }
}
