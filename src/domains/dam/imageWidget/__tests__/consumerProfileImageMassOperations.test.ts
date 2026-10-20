import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNameLookups } from '@/domains/dam/__tests__/support/damNames'
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
  /** The form above a gallery of the given images. */
  const mountOver = async (gallery: ImageStoreItem[]) => {
    useImageStore(pinia).setImages(gallery)
    wrapper = mount(ImageMassOperations, {
      attachTo: document.body,
      // What the input of authors renders asks the DAM for names to offer.
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
  }
  /** The form above a gallery of two images: the first has its texts, the second has none. */
  const mountAbove = (offersDamAuthors: boolean) =>
    mountOver([
      image('file-1', {
        texts: { description: 'kept', source: 'kept' },
        damAuthors: offersDamAuthors ? ['author-1'] : [],
        showDamAuthors: offersDamAuthors,
      }),
      image('file-2', { showDamAuthors: offersDamAuthors }),
    ])
  const images = () => useImageStore(pinia).images
  const DESCRIPTION = damText('image.model.texts.description')
  const AUTHORS = damText('asset.model.authors')
  /** The source as the application names it: admin-ugc has a word of its own. */
  const source = () => useCommonAdminCoreDamOptions('default').sourceLabel
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

  // "Fill empty" takes a row for empty by the authors of the DAM it holds, also a row that does not offer them and
  // shows its source: it wrote the names of the picked authors over a source the user had typed. A source that is
  // shown and filled in is kept; an empty one gets the names, as before. admin-ugc has no authors of the DAM.
  if (isCms) {
    describe('the authors, above a gallery some rows of which show their source', () => {
      const texts = (source: string) => ({ description: '', source })
      /** Two rows that offer the authors of the DAM, six that show their source; the name of each says its state. */
      const mountOverBoth = () =>
        mountOver([
          // Its stored source is not shown: the authors are, in its place.
          image('offers, none picked', { showDamAuthors: true, texts: texts('stored') }),
          image('offers, one picked', { showDamAuthors: true, damAuthors: ['author-1'], texts: texts('Name of 1') }),
          // The DAM did not return its asset, or the asset was not read when it was picked.
          image('source typed', { texts: texts('typed by hand') }),
          image('source empty'),
          // Its asset has an author, whose name came in as the source, and which the user has left or taken out.
          image('source of an author', { damAuthors: ['author-9'], texts: texts('Name of 9') }),
          image('source emptied, of an author', { damAuthors: ['author-9'] }),
          // Empty as well: a source the image came without, and one of nothing but spaces.
          image('source missing', { texts: { description: '' } as ImageStoreItem['texts'] }),
          image('source of spaces', { texts: texts('   ') }),
        ])
      const asMounted = [
        ['offers, none picked', [], 'stored'],
        ['offers, one picked', ['author-1'], 'Name of 1'],
        ['source typed', [], 'typed by hand'],
        ['source empty', [], ''],
        ['source of an author', ['author-9'], 'Name of 9'],
        ['source emptied, of an author', ['author-9'], ''],
        ['source missing', [], undefined],
        ['source of spaces', [], '   '],
      ]
      /** The authors of the DAM and the source each row holds, shown or not. */
      const held = () => images().map((one) => [one.key, one.damAuthors, one.texts.source])
      const pickAuthors = async (authors: string[]) => {
        wrapper!.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
        await flushPromises()
      }
      const press = (text: string) =>
        wrapper!
          .findAll('button')
          .find((button) => button.text() === text)!
          .trigger('click')
      /** Whatever a press started has had the time to ask the DAM and to write. */
      const settled = async () => {
        await flushPromises()
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const filled = [
        ['offers, none picked', ['author-7'], 'Name of author-7'],
        ['offers, one picked', ['author-1'], 'Name of 1'],
        // Shown and filled in: kept. It used to become the names of the picked authors.
        ['source typed', [], 'typed by hand'],
        // Shown and empty: the names of the picked authors, as before. The authors are not shown, nor saved.
        ['source empty', ['author-7'], 'Name of author-7'],
        // Holding authors of the DAM: passed over, as before, whatever its source.
        ['source of an author', ['author-9'], 'Name of 9'],
        ['source emptied, of an author', ['author-9'], ''],
        // Shown and missing, or of spaces alone: empty, and filled as before.
        ['source missing', ['author-7'], 'Name of author-7'],
        ['source of spaces', ['author-7'], 'Name of author-7'],
      ]

      it('"fill empty" gives the picked authors to the rows without any, but for a row that shows a source filled in', async () => {
        await mountOverBoth()
        await pickAuthors(['author-7'])

        await named(fillEmpty(AUTHORS)).trigger('click')
        await vi.waitFor(() => expect(images()[0].damAuthors).toEqual(['author-7']))

        expect(held()).toEqual(filled)
      })

      it('"fill all empty" under the form fills the authors by the same rule', async () => {
        await mountOverBoth()
        await pickAuthors(['author-7'])

        await press(damText('asset.massOperations.fillAllEmpty'))
        await vi.waitFor(() => expect(images()[0].damAuthors).toEqual(['author-7']))

        expect(held()).toEqual(filled)
      })

      // The button can be pressed whatever is picked. No authors picked are no authors to fill in: it used to ask
      // the DAM for the names of nobody, and to take away the source of every row without authors of the DAM.
      it('"fill empty" does nothing while no author is picked, and asks the DAM for no name', async () => {
        await mountOverBoth()
        expect(named(fillEmpty(AUTHORS)).element.disabled).toBe(false)

        await named(fillEmpty(AUTHORS)).trigger('click')
        await settled()

        expect(held()).toEqual(asMounted)
        expect(damNameLookups(dam)).toEqual([])
      })

      // "Replace" is the user's word for every row, as before: also for a row that shows its source.
      it('"replace" gives the picked authors, and their names as the source, to every row', async () => {
        await mountOverBoth()
        await pickAuthors(['author-7'])

        await named(replace(AUTHORS)).trigger('click')
        await vi.waitFor(() => expect(images()[4].damAuthors).toEqual(['author-7']))

        expect(held()).toEqual(asMounted.map(([key]) => [key, ['author-7'], 'Name of author-7']))
      })

      // As before too, and here to say what it does: with no author picked it takes them away, and the source with
      // them, from every row.
      it('"replace" with no author picked empties the authors and the source of every row', async () => {
        await mountOverBoth()

        await named(replace(AUTHORS)).trigger('click')
        await vi.waitFor(() => expect(images()[4].damAuthors).toEqual([]))
        await settled()

        expect(held()).toEqual(asMounted.map(([key]) => [key, [], '']))
      })
    })
  }
})
