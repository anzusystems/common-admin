import { createI18nMessage } from '@vuelidate/validators'
import { Ref } from 'vue'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateLongitudeNotZeroAsLatitude() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(
    (value: string, siblings: { latitudeText: Ref<string> }, vm: { required: boolean }): boolean => {
      return vm.required ? !(parseFloat(value) === 0 && parseFloat(siblings.latitudeText.value) === 0) : true
    },
    {
      messagePath: () => 'validations.js.required',
    }
  )
}
