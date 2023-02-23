import { ref } from 'vue'
import type { I18n } from 'vue-i18n'

export const i18nInstance = ref<undefined | I18n>(undefined)

export function createI18nInstance(instance: I18n) {
  // @ts-ignore
  i18nInstance.value = instance
  return i18nInstance.value
}

export function useI18n() {
  return {
    t: i18nInstance.value?.global?.t ? i18nInstance.value.global.t : (key: string) => key,
  }
}
