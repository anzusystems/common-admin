import { computed, type Ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { isNull, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import { useValidate } from '@/validators/vuelidate/useValidate.ts'
import useVuelidate from '@vuelidate/core'
import type { DatetimeUTCNullable } from '@/types/common.ts'

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
        title: '1 hodina',
      },
      {
        value: 1_440,
        title: '1 deň',
      },
      {
        value: 10_080,
        title: '7 dní',
      },
      {
        value: 40_320,
        title: '28 dní',
      },
      {
        value: TimeIntervalSpecialOptions.CurrentMonth,
        title: 'Prebiehajúci mesiac',
      },
      {
        value: TimeIntervalSpecialOptions.LastMonth,
        title: 'Minulý mesiac',
      },
      {
        value: TimeIntervalSpecialOptions.Last3Months,
        title: 'Posledné 3 mesiace',
      },
      {
        value: TimeIntervalSpecialOptions.Custom,
        title: 'Vlastné',
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

