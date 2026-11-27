import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import ACustomDataFormElement from '@/domains/customDataForm/components/ACustomDataFormElement.vue'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import {
  customDataFormElementName,
  damCustomFormElementNameKey,
  type DamCustomFormKind,
  withDamCustomFormElementNameKeys,
} from '@/domains/customDataForm/utils/customDataFormElementName'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import csTexts from '@/locales/cs/common/damCustomFormElement.json'
import enTexts from '@/locales/en/common/damCustomFormElement.json'
import skTexts from '@/locales/sk/common/damCustomFormElement.json'
import { i18n as libraryI18n, setCommonAdminI18n } from '@/plugins/i18n'

// Every element of every DAM custom form, as core_dam.custom_form_element held them (2026-11-26):
// asset forms of all ext systems and asset types, distribution forms of the Artemis podcast and video.
const DAM_ELEMENTS: Record<DamCustomFormKind, string[]> = {
  asset: [
    'title',
    'description',
    'author',
    'authors',
    'keywords',
    'location',
    'sourceKeywords',
    'mediaApiIds',
    'mediaApiPaths',
    'focusX',
    'focusY',
    'providerType',
    'providerId',
    'originalUrl',
    'isChild',
  ],
  distribution: [
    'title',
    'description',
    'authors',
    'keywords',
    'createArticle',
    'rubricId',
    'podcastId',
    'episodeId',
    'extRssId',
    'bonusEpisode',
    'bonusUrl',
    'freeUrl',
    'premiumUrl',
    'duration',
    'premiumDuration',
    'bonusDuration',
  ],
}

const LANGUAGES = { sk: skTexts, en: enTexts, cs: csTexts } as const
type Texts = Record<string, Record<string, unknown>>

const keysOf = (texts: Texts) =>
  Object.entries(texts)
    .flatMap(([kind, properties]) => Object.keys(properties).map((property) => `${kind}.${property}`))
    .sort()

const i18nIn = (locale: keyof typeof LANGUAGES) =>
  createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } })

const element = (property: string, name: string, nameKey?: string): CustomDataFormElement => ({
  id: property,
  property,
  name,
  nameKey,
  position: 1,
  attributes: {
    type: CustomDataFormElementType.String,
    minValue: null,
    maxValue: null,
    minCount: null,
    maxCount: null,
    required: false,
    searchable: false,
    readonly: false,
  },
})

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
afterAll(() => setCommonAdminI18n(libraryI18n as never))

describe('names of DAM form elements', () => {
  it('have the same keys in every language, each with a text', () => {
    const skKeys = keysOf(skTexts as Texts)
    expect(keysOf(enTexts as Texts)).toEqual(skKeys)
    expect(keysOf(csTexts as Texts)).toEqual(skKeys)
    // Through vue-i18n: the build compiles the JSON messages into functions.
    for (const language of Object.keys(LANGUAGES) as Array<keyof typeof LANGUAGES>) {
      const { t, te } = i18nIn(language).global
      for (const key of skKeys) {
        const path = `common.damCustomFormElement.${key}`
        expect(te(path), `${language}: ${key}`).toBe(true)
        expect(t(path).trim(), `${language}: ${key}`).not.toBe('')
        expect(t(path), `${language}: ${key}`).not.toBe(path)
      }
    }
  })

  it('cover every element of the DAM forms, and nothing else', () => {
    // The name a form element had in the DAM was the label, in whatever language it was stored in.
    const expected = Object.entries(DAM_ELEMENTS)
      .flatMap(([kind, properties]) => properties.map((property) => `${kind}.${property}`))
      .sort()
    expect(keysOf(skTexts as Texts)).toEqual(expected)
  })

  it.each([
    ['sk', 'Popis', 'Titulok'],
    ['en', 'Description', 'Title'],
    ['cs', 'Popis', 'Titulek'],
  ] as const)('are in the language of the admin, %s', (locale, description, title) => {
    setCommonAdminI18n(i18nIn(locale) as never)
    // As stored in the cms form: an English title next to a Slovak description.
    const [stored, storedTitle] = withDamCustomFormElementNameKeys('asset', [
      element('description', 'Popis'),
      element('title', 'Title'),
    ])

    expect(customDataFormElementName(stored!)).toBe(description)
    expect(customDataFormElementName(storedTitle!)).toBe(title)
  })

  it('keep the stored name for a DAM element the library has no text for, and for a form of another system', () => {
    setCommonAdminI18n(i18nIn('en') as never)
    const [added] = withDamCustomFormElementNameKeys('asset', [element('addedLater', 'Pridané neskôr')])

    expect(added!.nameKey).toBe(damCustomFormElementNameKey('asset', 'addedLater'))
    expect(customDataFormElementName(added!)).toBe('Pridané neskôr')
    // A CMS form element has no key: its stored name is the label even where a DAM property of that name exists.
    expect(customDataFormElementName(element('description', 'Perex boxu'))).toBe('Perex boxu')
  })

  it('do not share a text between an asset form and a distribution form', () => {
    expect(damCustomFormElementNameKey('asset', 'title')).not.toBe(damCustomFormElementNameKey('distribution', 'title'))
  })

  it('label the field and the read-only row of a form', () => {
    const i18n = i18nIn('en')
    setCommonAdminI18n(i18n as never)
    const [description] = withDamCustomFormElementNameKeys('asset', [element('description', 'Popis')])

    const field = mount(ACustomDataFormElement, {
      global: { plugins: [i18n] },
      props: { config: description!, modelValue: '' },
    })
    wrappers.push(field)
    expect(field.find('label').text()).toBe('Description')

    const readonly = mount(ACustomDataForm, {
      global: { plugins: [i18n] },
      props: { modelValue: { description: 'x' }, elements: [description!], pinnedCount: 1, readonly: true },
    })
    wrappers.push(readonly)
    expect(readonly.text()).toContain('Description')
    expect(readonly.text()).not.toContain('Popis')
  })
})
