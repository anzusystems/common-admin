import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import AssetQueueSelectedSidebar from '@/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'

// The mass operations of the queue dialog, under each of the two applications: a scratch form beside the rows,
// whose values the user copies into the rows, one field at a time or all at once. The real form over the real
// queue; what the copying does to a list of rows of every kind is in `uploadQueueMassOperations.test.ts`. The rows
// are copies to the licence, which send nothing; no request of the DAM is part of what is asked here.

const QUEUE = 'mass-operations'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

describe.each(consumerProfiles)('the mass operations of an upload queue under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration
  /** The custom fields of the application's images: the first is left empty on the scratch form in every case. */
  const [untouched, typedInto] = isCms ? ['title', 'description'] : ['description', 'author']

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    waits.restore()
    useDamNotificationsEventBus().reset()
  })

  /** A queue of three rows, and the scratch form beside them. */
  const mountBesideRows = async (count = 3) => {
    const store = useUploadQueuesStore(pinia)
    await store.addByCopyToLicence(
      QUEUE,
      extSystem,
      licence,
      Array.from({ length: count }, (_, index) => `asset-${index + 1}`)
    )
    wrapper = mount(AssetQueueSelectedSidebar, {
      attachTo: document.body,
      props: { queueKey: QUEUE, extSystem },
      // What the inputs of keywords and authors render asks the DAM for names to offer.
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
    return store.getQueueItems(QUEUE)
  }
  const customFields = () =>
    wrapper!.findAll('.v-field').map((field) => ({
      label: field.find('.v-label').text(),
      input: field.find<HTMLInputElement | HTMLTextAreaElement>('input, textarea:not([aria-hidden="true"])'),
    }))
  const customField = (label: string) => customFields().find((field) => field.label === label)!
  /**
   * The two buttons on the line of a field: the one that fills the rows where it is empty, the one that replaces it.
   * Each is found by its accessible name, which says what it does and to which field.
   */
  const onTheLine = (line: Element, field: string) => {
    const button = (name: string) =>
      line.querySelector<HTMLButtonElement>(
        `button[aria-label="${damText(`asset.massOperations.${name}`, { field })}"]`
      )!
    return { fillEmpty: button('fillOneEmptyField'), replace: button('replaceOneField') }
  }
  /** Beside a custom field, which is named by its label. */
  const beside = (field: DOMWrapper<Element>, label: string) => onTheLine(field.element.closest('.d-flex')!, label)
  // The inputs of keywords and authors sit in a box of their own, beside their two buttons.
  const besideList = (input: VueWrapper, label: string) =>
    onTheLine(input.element.closest('[style*="min-width"]')!.parentElement!, label)
  const KEYWORDS = damText('asset.model.keywords')
  const AUTHORS = damText('asset.model.authors')
  const keywords = () => wrapper!.findComponent(KeywordRemoteAutocompleteWithCached)
  const authors = () => wrapper!.findComponent(AuthorRemoteAutocompleteWithCached)
  /** The words of the tooltip of the button of that name, as a pointer over the button opens them. */
  const tooltipOf = async (name: string) => {
    const button = wrapper!.findAllComponents({ name: 'VBtn' }).find((one) => one.attributes('aria-label') === name)!
    const tooltip = button.findComponent({ name: 'VTooltip' })
    button.element.dispatchEvent(new MouseEvent('mouseenter'))
    const opened = () => {
      const content = (tooltip.vm as unknown as { contentEl?: HTMLElement }).contentEl
      return content?.closest('.v-overlay--active') ? content : null
    }
    await vi.waitFor(() => expect(opened()).not.toBeNull())

    return opened()!.textContent!.trim()
  }
  const atTheBottom = (name: 'fillAllEmpty' | 'replaceAll' | 'clearForm') =>
    wrapper!
      .findAll('.sidebar-info__actions button')
      .find((button) => button.text() === damText(`asset.massOperations.${name}`))!

  it('offers the custom fields of the application, and the keywords and authors of the DAM only where it has them', async () => {
    await mountBesideRows()

    expect(customFields().map((field) => field.label)).toEqual([untouched, typedInto])
    expect([keywords().exists(), authors().exists()]).toEqual([isCms, isCms])
    expect(wrapper!.text().includes(damText('asset.massOperations.general'))).toBe(isCms)
    expect(wrapper!.text()).toContain(damText('asset.assetType.image'))
    expect(wrapper!.text()).toContain(damText('asset.massOperations.description'))
  })

  // First set, point 7: who cannot see the icons hears which field each of the two buttons beside it acts on.
  it('names the two buttons beside each field by what they do and by the field', async () => {
    await mountBesideRows()
    const fields = [...(isCms ? [KEYWORDS, AUTHORS] : []), untouched, typedInto]
    const names = wrapper!.findAll('button[aria-label]').map((button) => button.attributes('aria-label')!)

    expect(names.filter((name) => name.includes(': ')).sort()).toEqual(
      fields.flatMap((field) => [`Fill empty field: ${field}`, `Replace everywhere: ${field}`]).sort()
    )
    // The name without the field is the name of none of them any more; the tooltips keep it.
    expect(names).not.toContain(damText('asset.massOperations.fillOneEmpty'))
    expect(names).not.toContain(damText('asset.massOperations.replaceOne'))
  })

  // What is seen stays as it was: the tooltip of each button says what it does, and no field.
  it('keeps the tooltips of those buttons short, without the field', async () => {
    await mountBesideRows()
    const fields = [...(isCms ? [KEYWORDS, AUTHORS] : []), untouched, typedInto]

    const shown = await Promise.all(
      fields.flatMap((field) => [tooltipOf(`Fill empty field: ${field}`), tooltipOf(`Replace everywhere: ${field}`)])
    )

    expect(shown).toEqual(
      fields.flatMap(() => [damText('asset.massOperations.fillOneEmpty'), damText('asset.massOperations.replaceOne')])
    )
  })

  // A custom field is shown to the user under its name; its property is what the DAM knows it by, and what a row
  // keeps it under. The configurations of the tests name every field as its property.
  it('names the buttons of a custom field by the name it is shown under, and writes it under its property', async () => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === typedInto)!.name = 'Shown to the user'
    const [first] = await mountBesideRows()
    const names = wrapper!.findAll('button[aria-label]').map((button) => button.attributes('aria-label')!)

    expect(names.filter((name) => name.endsWith(': Shown to the user')).sort()).toEqual([
      'Fill empty field: Shown to the user',
      'Replace everywhere: Shown to the user',
    ])
    expect(names.filter((name) => name.endsWith(`: ${typedInto}`))).toEqual([])

    await customField('Shown to the user').input.setValue('for all')
    beside(customField('Shown to the user').input, 'Shown to the user').replace.click()
    await flushPromises()

    expect(first.customData).toEqual({ [typedInto]: 'for all' })
  })

  it('offers no field beside a queue without rows, only its three buttons', async () => {
    await mountBesideRows(0)

    expect(customFields()).toEqual([])
    expect([keywords().exists(), authors().exists()]).toEqual([false, false])
    expect(wrapper!.findAll('.sidebar-info__actions button').map((button) => button.text())).toEqual([
      damText('asset.massOperations.fillAllEmpty'),
      damText('asset.massOperations.replaceAll'),
      damText('asset.massOperations.clearForm'),
    ])
  })

  describe('one custom field', () => {
    it('"fill empty field" writes it into the rows that have none, and leaves the other fields of the form out', async () => {
      const [first, second, third] = await mountBesideRows()
      second.customData = { [typedInto]: 'of the row', [untouched]: 'kept' }
      await customField(typedInto).input.setValue('for all')
      await customField(untouched).input.setValue('not asked for')

      beside(customField(typedInto).input, typedInto).fillEmpty.click()
      await flushPromises()

      expect([first, second, third].map((row) => row.customData)).toEqual([
        { [typedInto]: 'for all' },
        { [typedInto]: 'of the row', [untouched]: 'kept' },
        { [typedInto]: 'for all' },
      ])
    })

    it('"replace everywhere" writes it into every row, over what the row had', async () => {
      const [first, second, third] = await mountBesideRows()
      second.customData = { [typedInto]: 'of the row', [untouched]: 'kept' }
      await customField(typedInto).input.setValue('for all')

      beside(customField(typedInto).input, typedInto).replace.click()
      await flushPromises()

      expect([first, second, third].map((row) => row.customData)).toEqual([
        { [typedInto]: 'for all' },
        { [typedInto]: 'for all', [untouched]: 'kept' },
        { [typedInto]: 'for all' },
      ])
    })
  })

  describe('the whole form', () => {
    it('"fill only empty" writes every field the user filled into the rows where that field is empty', async () => {
      const [first, second] = await mountBesideRows(2)
      second.customData = { [typedInto]: 'of the row' }
      await customField(typedInto).input.setValue('for all')

      await atTheBottom('fillAllEmpty').trigger('click')

      // A field the user never touched on the form is not written at all.
      expect([first.customData, second.customData]).toEqual([{ [typedInto]: 'for all' }, { [typedInto]: 'of the row' }])
    })

    it('"replace all" writes every field the user filled into every row', async () => {
      const [first, second] = await mountBesideRows(2)
      second.customData = { [typedInto]: 'of the row', [untouched]: 'kept' }
      await customField(typedInto).input.setValue('for all')

      await atTheBottom('replaceAll').trigger('click')

      expect([first.customData, second.customData]).toEqual([
        { [typedInto]: 'for all' },
        { [typedInto]: 'for all', [untouched]: 'kept' },
      ])
    })

    it('"clear" empties the form, and leaves the rows as they are', async () => {
      const [first] = await mountBesideRows(1)
      first.customData = { [typedInto]: 'of the row' }
      await customField(typedInto).input.setValue('for all')

      await atTheBottom('clearForm').trigger('click')

      expect(customFields().map((field) => field.input.element.value)).toEqual(['', ''])
      expect(first.customData).toEqual({ [typedInto]: 'of the row' })
      // Nothing is left on the form to write.
      await atTheBottom('replaceAll').trigger('click')
      expect(first.customData).toEqual({ [typedInto]: 'of the row' })
    })
  })

  // admin-ugc has neither: its rows are never given keywords or authors by this form.
  if (isCms) {
    describe('the keywords and the authors of the DAM', () => {
      /** The user picks them in the two inputs of the form. */
      const pickOnTheForm = async () => {
        keywords().vm.$emit('update:modelValue', ['keyword-form'])
        authors().vm.$emit('update:modelValue', ['author-form'])
        await flushPromises()
      }

      it('are each written into the rows that have none by "fill empty field", and into every row by "replace everywhere"', async () => {
        const [first, second] = await mountBesideRows(2)
        second.keywords = ['keyword-row']
        second.authors = ['author-row']
        await pickOnTheForm()

        besideList(keywords(), KEYWORDS).fillEmpty.click()
        expect([first, second].map((row) => [row.keywords, row.authors])).toEqual([
          [['keyword-form'], []],
          [['keyword-row'], ['author-row']],
        ])

        besideList(authors(), AUTHORS).replace.click()
        expect([first, second].map((row) => [row.keywords, row.authors])).toEqual([
          [['keyword-form'], ['author-form']],
          [['keyword-row'], ['author-form']],
        ])

        besideList(keywords(), KEYWORDS).replace.click()
        besideList(authors(), AUTHORS).fillEmpty.click()
        expect([first, second].map((row) => [row.keywords, row.authors])).toEqual([
          [['keyword-form'], ['author-form']],
          [['keyword-form'], ['author-form']],
        ])
      })

      it('go with the whole form: "fill only empty" into the rows that have none', async () => {
        const [first, second] = await mountBesideRows(2)
        second.keywords = ['keyword-row']
        await pickOnTheForm()

        await atTheBottom('fillAllEmpty').trigger('click')

        expect([first, second].map((row) => [row.keywords, row.authors])).toEqual([
          [['keyword-form'], ['author-form']],
          [['keyword-row'], ['author-form']],
        ])
      })

      // Today's behaviour, pinned as it is: "replace all" writes the two lists as they are on the form, also when
      // the user picked nothing there, while a custom field left untouched is not written. A form with one custom
      // field filled thus takes the keywords and authors off every row.
      it('are taken off every row by "replace all" when the form has none picked', async () => {
        const [first, second] = await mountBesideRows(2)
        first.keywords = ['keyword-row']
        second.authors = ['author-row']
        second.customData = { [untouched]: 'kept' }
        await customField(typedInto).input.setValue('for all')

        await atTheBottom('replaceAll').trigger('click')

        expect([first, second].map((row) => [row.keywords, row.authors])).toEqual([
          [[], []],
          [[], []],
        ])
        expect([first.customData, second.customData]).toEqual([
          { [typedInto]: 'for all' },
          { [typedInto]: 'for all', [untouched]: 'kept' },
        ])
      })

      it('are emptied on the form by "clear"', async () => {
        await mountBesideRows(1)
        await pickOnTheForm()
        expect([keywords().props('modelValue'), authors().props('modelValue')]).toEqual([
          ['keyword-form'],
          ['author-form'],
        ])

        await atTheBottom('clearForm').trigger('click')

        expect([keywords().props('modelValue'), authors().props('modelValue')]).toEqual([[], []])
      })
    })
  }

  it('asks nothing of the DAM', async () => {
    await mountBesideRows()
    await customField(typedInto).input.setValue('for all')
    await atTheBottom('replaceAll').trigger('click')

    expect(dam.requests).toEqual([])
  })
})

// The components are mounted in English; the two names are in three languages, and each is to say the field.
describe('the names of the two buttons beside a field of the mass operations', () => {
  const languages = createI18n({ legacy: false, locale: 'en', messages: { sk, en, cs } })

  it.each([
    ['sk', 'Vyplňte prázdne pole: Titulok', 'Nahradiť všade: Titulok'],
    ['en', 'Fill empty field: Titulok', 'Replace everywhere: Titulok'],
    ['cs', 'Vyplňte prázdné pole: Titulok', 'Nahradit všude: Titulok'],
  ] as const)('say the field after what the button does, in %s', (language, fillEmpty, replace) => {
    const name = (key: string) =>
      languages.global.t(`common.damImage.asset.massOperations.${key}`, { field: 'Titulok' }, { locale: language })

    expect(name('fillOneEmptyField')).toBe(fillEmpty)
    expect(name('replaceOneField')).toBe(replace)
  })
})
