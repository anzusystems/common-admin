import { createI18nMessage, helpers } from '@vuelidate/validators'
import { unref } from 'vue'

export function useValidateStringArrayItemLength(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  const stringArrayItemLengthValidator = (min: number, max: number) => {
    return (value: string[]) =>
      !helpers.req(value) || value.every((item) => item.length >= unref(min) && item.length <= unref(max))
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

  return withI18nMessage(stringArrayItemLengthHelper, {
    withArguments: true,
    messagePath: () => 'validations.stringArrayItemLength',
  })
}
