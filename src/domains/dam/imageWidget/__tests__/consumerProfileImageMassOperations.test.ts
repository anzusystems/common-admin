import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { damText } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import ImageMassOperations from '@/domains/dam/imageWidget/components/ImageMassOperations.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

// The mass operations of a gallery, under each of the two applications: a scratch form above the images, whose
// values the user copies into them, one field at a time or all at once. Beside each field two buttons that are
// icons: who cannot see them hears what each does, and to which field. The real form over the real image store; the
// DAM is a client that records its requests, asked only for the names of the authors picked.

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined

describe.each(consumerProfiles)('the mass operations of a gallery under the $name', (profile) => {
  const { endPoints, licence } = profile
  const isCms = profile === cmsConfiguration

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    answerDamNames(dam)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const image = (file: string, parts: Partial<ImageStoreItem> = {}): ImageStoreItem => ({
    key: file,
    texts: { description: '', source: '' },
    flags: { showSource: true, internal: false, overrideInternal: false },
    dam: { damId: file, licenceId: licence, regionPosition: 0, internal: false },
    position: 1,
    damAuthors: [],
    showDamAuthors: false,
    assetId: `asset-of-${file}`,
    ...parts,
  })
  /** The form above a gallery of two images: the first has its texts, the second has none. */
  const mountAbove = async (offersDamAuthors: boolean) => {
    useImageStore(pinia).setImages([
      image('file-1', {
        texts: { description: 'kept', source: 'kept' },
        damAuthors: offersDamAuthors ? ['author-1'] : [],
        showDamAuthors: offersDamAuthors,
      }),
      image('file-2', { showDamAuthors: offersDamAuthors }),
    ])
    wrapper = mount(ImageMassOperations, {
      attachTo: document.body,
      // What the input of authors renders asks the DAM for names to offer.
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
  }
  const images = () => useImageStore(pinia).images
  const DESCRIPTION = damText('image.model.texts.description')
  const AUTHORS = damText('asset.model.authors')
  /** The source as the application names it: admin-ugc has a word of its own. */
  const source = () => useCommonAdminCoreDamOptions().sourceLabel
  /** The names of the buttons that are icons: each says what it does, a colon, and its field. */
  const names = () =>
    wrapper!
      .findAll('button[aria-label]')
      .map((button) => button.attributes('aria-label')!)
      .filter((name) => name.includes(': '))
  const named = (name: string) => wrapper!.find<HTMLButtonElement>(`button[aria-label="${name}"]`)
  const fillEmpty = (field: string) => damText('asset.massOperations.fillOneEmptyField', { field })
  const replace = (field: string) => damText('asset.massOperations.replaceOneField', { field })
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
  // A growing text field has a hidden twin that measures it.
  const typeInto = async (label: string, text: string) => {
    const field = wrapper!
      .findAll('.v-field')
      .find((one) => one.find('.v-label').text() === label)!
      .find<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')
    await field.setValue(text)
  }

  // admin-cms offers the authors of the DAM in place of the source as soon as one image of the gallery does;
  // admin-ugc has no authors of the DAM, and always its source.
  const secondFieldCases: Array<[string, boolean]> = isCms
    ? [
        ['an image offers the authors of the DAM', true],
        ['no image offers the authors of the DAM', false],
      ]
    : [['the application has no authors of the DAM', false]]

  describe.each(secondFieldCases)('where %s', (_what, offersDamAuthors) => {
    const secondField = () => (offersDamAuthors ? AUTHORS : source())

    // The two pairs had the same two names: "Fill empty" and "Replace everywhere", twice.
    it('names the two buttons beside each field by what they do and by the field', async () => {
      await mountAbove(offersDamAuthors)

      expect(names().sort()).toEqual(
        [DESCRIPTION, secondField()].flatMap((field) => [fillEmpty(field), replace(field)]).sort()
      )
      expect(fillEmpty(DESCRIPTION)).toBe(`Fill empty field: ${DESCRIPTION}`)
      expect(replace(DESCRIPTION)).toBe(`Replace everywhere: ${DESCRIPTION}`)
      expect(new Set(names()).size).toBe(4)
      // The name without the field is the name of no button any more; the tooltips keep it.
      const all = wrapper!.findAll('button[aria-label]').map((button) => button.attributes('aria-label'))
      expect(all).not.toContain(damText('asset.massOperations.fillOneEmpty'))
      expect(all).not.toContain(damText('asset.massOperations.replaceOne'))
    })

    // What is seen stays as it was: the tooltip of each button says what it does, and no field.
    it('keeps the tooltips of those buttons short, without the field', async () => {
      await mountAbove(offersDamAuthors)
      const fields = [DESCRIPTION, secondField()]

      const shown = await Promise.all(
        fields.flatMap((field) => [tooltipOf(fillEmpty(field)), tooltipOf(replace(field))])
      )

      expect(shown).toEqual(
        fields.flatMap(() => [damText('asset.massOperations.fillOneEmpty'), damText('asset.massOperations.replaceOne')])
      )
    })

    it('does with the description what the name of each of its buttons says', async () => {
      await mountAbove(offersDamAuthors)
      await typeInto(DESCRIPTION, 'for all')

      await named(fillEmpty(DESCRIPTION)).trigger('click')
      expect(images().map((one) => one.texts.description)).toEqual(['kept', 'for all'])

      await named(replace(DESCRIPTION)).trigger('click')
      expect(images().map((one) => one.texts.description)).toEqual(['for all', 'for all'])
      // The other field of the images is left alone.
      expect(images().map((one) => one.texts.source)).toEqual(['kept', ''])
    })

    it('does with the other field what the name of each of its buttons says', async () => {
      await mountAbove(offersDamAuthors)
      if (offersDamAuthors) {
        wrapper!.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-7'])
        await flushPromises()

        await named(fillEmpty(AUTHORS)).trigger('click')
        await vi.waitFor(() => expect(images().map((one) => one.damAuthors)).toEqual([['author-1'], ['author-7']]))
        expect(images().map((one) => one.texts.source)).toEqual(['kept', 'Name of author-7'])

        await named(replace(AUTHORS)).trigger('click')
        await vi.waitFor(() => expect(images().map((one) => one.damAuthors)).toEqual([['author-7'], ['author-7']]))
        expect(images().map((one) => one.texts.source)).toEqual(['Name of author-7', 'Name of author-7'])
      } else {
        await typeInto(source(), 'for all')

        await named(fillEmpty(source())).trigger('click')
        expect(images().map((one) => one.texts.source)).toEqual(['kept', 'for all'])

        await named(replace(source())).trigger('click')
        expect(images().map((one) => one.texts.source)).toEqual(['for all', 'for all'])
      }
      expect(images().map((one) => one.texts.description)).toEqual(['kept', ''])
    })
  })
})
