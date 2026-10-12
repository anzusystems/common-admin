import { afterEach, describe, expect, it } from 'vitest'
import { type App, createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { createAnzuVuetify } from '@/plugins/commonVuetifyConfig'

// An author the DAM suggests under a name that several authors have is offered as a chip with a "+", which adds
// the author to the field. The "+" is the close button of the chip, and a screen reader read it as "Close". The
// chip is mounted as an admin mounts it: with the Vuetify of the library, which translates through the i18n of the
// admin (the Vuetify of the test setup translates by itself, and would leave the key of the name as it is).

let app: App | undefined
let host: HTMLElement | undefined
afterEach(() => {
  app?.unmount()
  host?.remove()
  app = host = undefined
})

/** The chip of the author in an admin of that language; answers the ids its "+" asks to add. */
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
