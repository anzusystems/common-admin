import { createI18nMessage } from '@vuelidate/validators'
import type { Ref } from 'vue'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateLatitudeNotZeroAsLongitude() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(
    (value: string, siblings: { longitudeText: Ref<string> }, vm: { required: boolean }): boolean => {
      return vm.required ? !(parseFloat(value) === 0 && parseFloat(siblings.longitudeText.value) === 0) : true
    },
    {
      messagePath: () => 'validations.js.required',
    }
  )
}
