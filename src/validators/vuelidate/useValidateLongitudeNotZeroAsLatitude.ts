import { createI18nMessage } from '@vuelidate/validators'
import { Ref } from 'vue'

export function useValidateLongitudeNotZeroAsLatitude(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(
    (value: string, siblings: { latitudeText: Ref<string> }, vm: { required: boolean }): boolean => {
      return vm.required ? !(parseFloat(value) === 0 && parseFloat(siblings.latitudeText.value) === 0) : true
    },
    {
      messagePath: () => 'validations.required',
    }
  )
}
