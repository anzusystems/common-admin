import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, ref } from 'vue'
import { VDefaultsProvider } from 'vuetify/components'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'

// Where an admin makes autocomplete chips closable, closing a cached chip must remove its name from the value.
// The cached chip only hid itself and the name stayed. It is now handed the props of the chip slot.

const { extSystem } = cmsConfiguration

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(cmsConfiguration.endPoints)
  dam.reply((request) =>
    /\/(author|keyword)(\/|$)/.test(request.url.split('?')[0]!)
      ? { status: 200, data: { data: [], totalCount: 0 } }
      : undefined
  )
  waits = holdLongWaits()
  installConsumerProfile(cmsConfiguration, dam.client)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  waits.restore()
  signOutOfDam()
})

describe.each<[string, Component, string[]]>([
  ['keywords', KeywordRemoteAutocompleteWithCached, ['keyword-1', 'keyword-2']],
  ['authors', AuthorRemoteAutocompleteWithCached, ['author-1', 'author-2']],
])('the input of %s with closable chips', (_which, input, ids) => {
  it('takes the name of a closed chip out of its value', async () => {
    const value = ref<string[]>([...ids])
    const models: unknown[] = []
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(VDefaultsProvider, { defaults: { VAutocomplete: { closableChips: true } } }, () =>
            h(input, {
              extSystem,
              multiple: true,
              modelValue: value.value,
              'onUpdate:modelValue': (model: string[]) => {
                models.push(model)
                value.value = model
              },
            })
          ),
      }),
      { attachTo: document.body, global: { plugins: [pinia] } }
    )
    await flushPromises()
    const closes = () => wrapper!.findAll<HTMLButtonElement>('.v-chip__close')
    await vi.waitFor(() => expect(closes()).toHaveLength(2))

    closes()[0]!.element.click()
    await flushPromises()

    expect(models.at(-1)).toEqual([ids[1]])
  })
})
