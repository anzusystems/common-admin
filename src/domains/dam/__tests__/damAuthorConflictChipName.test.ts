import { afterEach, describe, expect, it } from 'vitest'
import { type App, createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { createAnzuVuetify } from '@/plugins/commonVuetifyConfig'

// The "+" of the chip is the chip's close button, so a screen reader read it as "Close".
// The chip is mounted with the library Vuetify, which translates through the admin
// i18n. The test setup Vuetify translates by itself and would hide the problem.

let app: App | undefined
let host: HTMLElement | undefined
afterEach(() => {
  app?.unmount()
  host?.remove()
  app = host = undefined
})

const mountChip = async (locale: string) => {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } })
  const added: unknown[] = []
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(AuthorRemoteAutocompleteCachedAuthorChipConflicts, {
    id: 'author-1',
    onAddAuthor: (id: unknown) => added.push(id),
  })
  app.use(i18n).use(createAnzuVuetify({ i18n })).mount(host)
  await nextTick()
  return added
}
const plus = () => host!.querySelector<HTMLButtonElement>('.v-chip__close')!

describe('the "+" of the chip of an author conflict', () => {
  it.each([
    ['sk', 'Pridať autora', 'Zatvoriť'],
    ['en', 'Add author', 'Close'],
    ['cs', 'Přidat autora', 'Zavřít'],
  ] as const)('is named by what it does, in %s: "%s"', async (locale, name, close) => {
    const added = await mountChip(locale)

    expect(plus().getAttribute('aria-label')).toBe(name)
    expect(plus().getAttribute('aria-label')).not.toBe(close)
    expect(plus().querySelector('.mdi-plus')).not.toBeNull()

    plus().click()
    expect(added).toEqual(['author-1'])
  })
})
