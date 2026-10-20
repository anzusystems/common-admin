import { afterEach, describe, expect, it } from 'vitest'
import { type App, createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { createAnzuVuetify } from '@/plugins/commonVuetifyConfig'

// Each author the DAM suggests under a name that several authors have is a chip with a "+" that adds that author.
// Every "+" was named "Add author" for a screen reader: of several, nothing said which author each one adds. The chips
// are mounted as an admin mounts them, with the Vuetify of the library over the i18n of the admin; the names of the
// authors are in the cache already.

let app: App | undefined
let host: HTMLElement | undefined
afterEach(() => {
  app?.unmount()
  host?.remove()
  app = host = undefined
  useDamCachedAuthors().cachedAuthors.value.clear()
})

const author = (id: string, name: string, identifier = '') => ({
  id,
  name,
  identifier,
  flags: { reviewed: true },
})

/** Chips of these authors in an admin of that language; answers the ids their "+" ask to add. */
const mountChips = async (locale: string, ids: string[]) => {
  const { addManualToCachedAuthors } = useDamCachedAuthors()
  addManualToCachedAuthors(author('author-1', 'Ján Novák') as never)
  addManualToCachedAuthors(author('author-2', 'Ján Novák', 'šport') as never)
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } })
  const added: unknown[] = []
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(
    defineComponent({
      setup: () => () =>
        ids.map((id) =>
          h(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id, onAddAuthor: (one: unknown) => added.push(one) })
        ),
    })
  )
  app.use(i18n).use(createAnzuVuetify({ i18n })).mount(host)
  await nextTick()
  return added
}
const pluses = () => Array.from(host!.querySelectorAll<HTMLButtonElement>('.v-chip__close'))
const names = () => pluses().map((plus) => plus.getAttribute('aria-label'))

describe('the "+" of the chip of an author conflict', () => {
  it.each([
    ['sk', 'Pridať autora Ján Novák'],
    ['en', 'Add author Ján Novák'],
    ['cs', 'Přidat autora Ján Novák'],
  ] as const)('is named by the author it adds, in %s: "%s"', async (locale, name) => {
    const added = await mountChips(locale, ['author-1'])

    expect(names()).toEqual([name])
    pluses()[0]!.click()
    expect(added).toEqual(['author-1'])
  })

  // Two authors of the same name differ by their identifier, as their chips show it.
  it('names the "+" of two authors of the same name apart, as their chips show them', async () => {
    const added = await mountChips('sk', ['author-1', 'author-2'])

    expect(names()).toEqual(['Pridať autora Ján Novák', 'Pridať autora Ján Novák (šport)'])
    pluses()[1]!.click()
    expect(added).toEqual(['author-2'])
  })
})
