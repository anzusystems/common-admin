import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { useTimeIntervalOptions } from '@/domains/filters/composables/filterTimeIntervalTools'

// The options are what the select and the filter chip show; an English admin must not read Slovak.
const titlesIn = (locale: 'en' | 'sk') => {
  let titles: string[] = []
  const Probe = defineComponent({
    setup() {
      const { timeIntervalOptions } = useTimeIntervalOptions()
      titles = timeIntervalOptions.value.map((option) => option.title)
      return () => h('div')
    },
  })
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { en, sk } })
  mount(Probe, { global: { plugins: [i18n] } }).unmount()
  return titles
}

describe('useTimeIntervalOptions', () => {
  it('translates every option title', () => {
    const inEn = titlesIn('en')
    const inSk = titlesIn('sk')
    expect(inEn).toHaveLength(9)
    const untranslated = inEn.filter((title, index) => title === inSk[index])
    expect(untranslated).toEqual([])
  })
})
