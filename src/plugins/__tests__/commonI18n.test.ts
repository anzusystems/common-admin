import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, ref, unref } from 'vue'
import { createI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { modifyLanguageSettings } from '@/domains/system/composables/languageSettings'
import { commonT, i18n as libraryI18n, setCommonAdminI18n } from '@/plugins/i18n'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import messagesEn from '@/locales/en'
import messagesSk from '@/locales/sk'

// The library translates through the admin's instance (plugin option `i18n`). It used to keep an
// instance of its own that every admin had to fill and switch by hand, next to its own.
const adminI18n = () =>
  createI18n({
    legacy: false,
    locale: 'sk',
    fallbackLocale: false,
    missingWarn: false,
    messages: { sk: { ...messagesSk, app: { title: 'Titulok' } }, en: { ...messagesEn, app: { title: 'Title' } } },
  })

// The chosen language lives in a module-level storage ref, which `localStorage.clear()` does not reset.
beforeEach(() => {
  modifyLanguageSettings(['sk', 'en'], 'sk', libraryI18n).setLanguage('sk')
})
afterEach(() => {
  setCommonAdminI18n(libraryI18n as never)
  localStorage.clear()
})

describe('the library translates through the admin i18n', () => {
  it('validators, alerts and the language switch follow the admin instance', async () => {
    const i18n = adminI18n()
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk', 'en'], default: 'sk' } })
    const { required } = useValidate()
    const v$ = useVuelidate({ title: { required } }, { title: ref('') })
    await v$.value.$validate()
    const message = () => unref(v$.value.title.$errors[0]!.$message)

    expect(message()).toBe(i18n.global.t('error.jsValidation.required'))
    expect(commonT('common.alert.fixValidationErrors')).toBe(i18n.global.t('common.alert.fixValidationErrors'))
    const skAlert = commonT('common.alert.fixValidationErrors')

    // What ALanguageSelect does: no instance passed.
    modifyLanguageSettings(['sk', 'en'], 'sk').setLanguage('en')
    expect(i18n.global.locale.value).toBe('en')
    await v$.value.$validate()

    expect(message()).toBe(i18n.global.t('error.jsValidation.required'))
    expect(commonT('common.alert.fixValidationErrors')).not.toBe(skAlert)
    expect(commonT('common.alert.fixValidationErrors')).toBe(i18n.global.t('common.alert.fixValidationErrors'))
  })

  it('a validator created before the plugin was installed still uses the admin instance', async () => {
    const { required } = useValidate()
    const i18n = adminI18n()
    i18n.global.locale.value = 'en'
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk', 'en'], default: 'sk' } })
    const v$ = useVuelidate({ title: { required } }, { title: ref('') })
    await v$.value.$validate()
    expect(unref(v$.value.title.$errors[0]!.$message)).toBe(
      i18n.global.t('error.jsValidation.required', {}, { locale: 'en' })
    )
  })

  it('switches the language only once its messages are loaded', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'sk',
      fallbackLocale: false,
      missingWarn: false,
      messages: { sk: messagesSk },
    })
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk', 'en'], default: 'sk' } })
    const settings = modifyLanguageSettings(['sk', 'en'], 'sk')

    settings.setLanguage('en')
    // No English messages yet: the page keeps Slovak instead of turning into raw keys.
    expect(i18n.global.locale.value).toBe('sk')

    settings.addMessages('en', messagesEn)
    expect(i18n.global.locale.value).toBe('en')
  })

  it('does not take the starting locale for a loaded one', () => {
    // As the admins create it: the starting locale, no messages until the chosen language loads.
    const i18n = createI18n({ legacy: false, locale: 'sk', fallbackLocale: false, missingWarn: false })
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk', 'en'], default: 'sk' } })
    const settings = modifyLanguageSettings(['sk', 'en'], 'sk')
    settings.addMessages('en', messagesEn)
    // Loaded, not chosen: nothing switches yet.
    expect(i18n.global.locale.value).toBe('sk')
    settings.setLanguage('en')
    expect(i18n.global.locale.value).toBe('en')

    settings.setLanguage('sk')
    expect(i18n.global.locale.value).toBe('en')

    settings.addMessages('sk', messagesSk)
    expect(i18n.global.locale.value).toBe('sk')
  })
})
