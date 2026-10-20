import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, type Component, createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { VDefaultsProvider } from 'vuetify/components'
import ACachedUserChip from '@/domains/cached/components/ACachedUserChip.vue'
import AJobStatusChip from '@/domains/job/components/AJobStatusChip.vue'
import { JobStatusDefault } from '@/domains/job/valueObject/JobStatus'
import AUserSystemStatusChip from '@/domains/anzuUser/components/AUserSystemStatusChip.vue'
import APermissionValueChip from '@/domains/permission/components/APermissionValueChip.vue'
import { Grant } from '@/domains/auth/valueObject/Grant'
import { GrantOriginDefault } from '@/domains/permission/valueObject/GrantOrigin'
import ABooleanValue from '@/domains/ui/components/ABooleanValue.vue'
import AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { createAnzuVuetify } from '@/plugins/commonVuetifyConfig'

// The chips of the library that an admin can make closable: a chip at the root of its component takes the `closable`
// of its caller, and the chip of a cached user takes it from Vuetify's defaults. Their close removes what the chip
// stands for, and says so: "Remove", where Vuetify says "Close". A caller names it otherwise as it likes.

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } }),
}))

let app: App | undefined
let host: HTMLElement | undefined
afterEach(() => {
  app?.unmount()
  host?.remove()
  app = host = undefined
})

/** The chip as an admin mounts it, with the Vuetify of the library translating through its i18n. */
const mountIn = async (locale: string, render: () => ReturnType<typeof h>) => {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } })
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(defineComponent({ setup: () => render }))
  app.use(i18n).use(createPinia()).use(createAnzuVuetify({ i18n })).mount(host)
  await flushPromises()
  await nextTick()
}
const closeName = () => host!.querySelector('.v-chip__close')?.getAttribute('aria-label')

const cachedUser = {
  id: 7,
  getCachedFn: () => ({
    id: 7,
    email: 'a@sme.sk',
    person: { fullName: 'A B' },
    avatar: { color: '#000000', text: 'AB' },
    _loaded: true,
  }),
  disableClick: true,
}
const closableChips = (chip: () => ReturnType<typeof h>) => () =>
  h(VDefaultsProvider, { defaults: { VChip: { closable: true } } }, chip)

const chips: Array<[string, Component, Record<string, unknown>]> = [
  ['AJobStatusChip', AJobStatusChip, { value: JobStatusDefault }],
  [
    'AUserSystemStatusChip',
    AUserSystemStatusChip,
    { axes: { load: 'loaded', presence: 'present', access: 'ok', enabled: true } },
  ],
  ['APermissionValueChip', APermissionValueChip, { grant: Grant.Allow, grantOrigin: GrantOriginDefault }],
  ['ABooleanValue', ABooleanValue, { value: true, chip: true }],
  ['AChipNoLink', AChipNoLink, {}],
]

describe('the close of a chip made closable', () => {
  it.each(chips)('names it "Remove": %s', async (_name, chip, props) => {
    await mountIn('en', () => h(chip, { ...props, closable: true }, () => 'a chip'))

    expect(closeName()).toBe('Remove')
  })

  it.each([
    ['sk', 'Odobrať'],
    ['en', 'Remove'],
    ['cs', 'Odebrat'],
  ])('names it in %s "%s": ACachedUserChip made closable by the defaults of Vuetify', async (locale, name) => {
    await mountIn(
      locale,
      closableChips(() => h(ACachedUserChip as Component, cachedUser))
    )

    expect(closeName()).toBe(name)
  })

  it('names it as its caller does', async () => {
    await mountIn('en', () => h(AChipNoLink, { closable: true, closeLabel: 'Dismiss' }, () => 'a chip'))
    expect(closeName()).toBe('Dismiss')
    app!.unmount()
    host!.remove()

    await mountIn(
      'en',
      closableChips(() => h(ACachedUserChip as Component, { ...cachedUser, closeLabel: 'Dismiss' }))
    )
    expect(closeName()).toBe('Dismiss')
  })
})
