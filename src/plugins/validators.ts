import * as validators from '@vuelidate/validators'
import type { Ref } from 'vue/dist/vue'
import { unref } from 'vue'
// import { useI18n } from '@/createCommonAdmin'
import { i18n } from '@/plugins/i18n'

// const i18nGlobal = useI18n()
// todo check if validations are working

const withI18nMessage = validators.createI18nMessage({ t: i18n.global.t.bind(i18n) })

export const required = withI18nMessage(validators.required, {
  messagePath: () => 'validations.required',
})
export const requiredIf = withI18nMessage(validators.requiredIf, {
  withArguments: true,
  messagePath: () => 'validations.required',
})
export const minLength = withI18nMessage(validators.minLength, {
  withArguments: true,
  messagePath: () => 'validations.minLength',
})
export const maxLength = withI18nMessage(validators.maxLength, {
  withArguments: true,
  messagePath: () => 'validations.maxLength',
})
export const between = withI18nMessage(validators.between, {
  withArguments: true,
  messagePath: () => 'validations.between',
})
export const minValue = withI18nMessage(validators.minValue, {
  withArguments: true,
  messagePath: () => 'validations.minValue',
})
export const maxValue = withI18nMessage(validators.maxValue, {
  withArguments: true,
  messagePath: () => 'validations.maxValue',
})
export const slug = withI18nMessage(validators.helpers.regex(/^[a-z\-0-9/]+$/), {
  messagePath: () => 'validations.slug',
})
export const url = withI18nMessage(validators.url, {
  messagePath: () => 'validations.url',
})
export const email = withI18nMessage(validators.email, {
  messagePath: () => 'validations.email',
})
export const phoneNumber = withI18nMessage(validators.helpers.regex(/^\+4219[0-9]{8}$/), {
  messagePath: () => 'validations.phoneNumber',
})
export const numeric = withI18nMessage(validators.numeric, {
  messagePath: () => 'validations.numeric',
})
export const latitude = withI18nMessage(
  validators.helpers.regex(/^(\+|-)?(?:90(?:(?:\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\.[0-9]{1,6})?))$/),
  {
    messagePath: () => 'validations.latitude',
  }
)
export const longitude = withI18nMessage(
  validators.helpers.regex(/^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/),
  {
    messagePath: () => 'validations.longitude',
  }
)

export const validateLatitudeNotZeroAsLongitude = withI18nMessage(
  (value: string, siblings: { longitudeText: Ref<string> }, vm: { required: boolean }): boolean => {
    return vm.required ? !(parseFloat(value) === 0 && parseFloat(siblings.longitudeText.value) === 0) : true
  },
  {
    messagePath: () => 'validations.required',
  }
)

export const validateLongitudeNotZeroAsLatitude = withI18nMessage(
  (value: string, siblings: { latitudeText: Ref<string> }, vm: { required: boolean }): boolean => {
    return vm.required ? !(parseFloat(value) === 0 && parseFloat(siblings.latitudeText.value) === 0) : true
  },
  {
    messagePath: () => 'validations.required',
  }
)

const stringArrayItemLengthValidator = (min: number, max: number) => {
  return (value: string[]) =>
    !validators.helpers.req(value) || value.every((item) => item.length >= unref(min) && item.length <= unref(max))
}
const stringArrayItemLengthHelper = (min: number, max: number) => {
  return {
    $validator: stringArrayItemLengthValidator(min, max),
    // $message not required when using i18n
    // $message: (input: { $params: Record<string, any> }) => {
    //   const { $params } = input
    //   return `Item length in list must have between ${$params.min} and ${$params.max} characters.`
    // },
    $params: {
      min,
      max,
      type: 'stringArrayItemLength',
    },
  }
}
export const stringArrayItemLength = withI18nMessage(stringArrayItemLengthHelper, {
  withArguments: true,
  messagePath: () => 'validations.stringArrayItemLength',
})
