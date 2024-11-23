import { type DatetimeUTCNullable, i18n } from '@anzusystems/common-admin'
import { createI18nMessage } from '@vuelidate/validators'
import { type ComputedRef, type Ref, type ShallowRef, unref, type WritableComputedRef } from 'vue'

const { t } = i18n.global

type OtherDateType =
  | Ref<DatetimeUTCNullable>
  | ComputedRef<DatetimeUTCNullable>
  | ShallowRef<DatetimeUTCNullable>
  | WritableComputedRef<DatetimeUTCNullable>

export function useValidateCompareDates() {
  const withI18nMessage = createI18nMessage({ t })

  const datesCompareValidator = (
    otherDate: OtherDateType,
    otherDateName: string,
    variant: 'laterThan' | 'onOrAfter' | 'earlierThan' | 'onOrBefore'
  ) => {
    return (value: DatetimeUTCNullable) => {
      const unrefOtherDate = unref(otherDate)

      if (value === null && unrefOtherDate === null) {
        return true
      }

      if (value === null || unrefOtherDate === null) {
        return true
      }

      const dateValue = new Date(value)
      const dateOther = new Date(unrefOtherDate)

      switch (variant) {
        case 'laterThan':
          return dateValue > dateOther
        case 'onOrAfter':
          return dateValue >= dateOther
        case 'earlierThan':
          return dateValue < dateOther
        case 'onOrBefore':
          return dateValue <= dateOther
        default:
          return false
      }
    }
  }

  const datesCompareHelper = (
    otherDate: OtherDateType,
    otherDateName: string,
    variant: 'laterThan' | 'onOrAfter' | 'earlierThan' | 'onOrBefore'
  ) => {
    return {
      $validator: datesCompareValidator(otherDate, otherDateName, variant),
      $params: {
        otherDateName: unref(otherDateName),
        variant,
        type: 'validateDate',
      },
    }
  }

  return withI18nMessage(datesCompareHelper, {
    withArguments: true,
    messagePath: (params) => `error.jsValidation.datesCompare.${params.$params.variant}`,
  })
}
