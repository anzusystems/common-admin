import { describe, expect, it } from 'vitest'
import {
  stringIsValidEmail,
  stringSplitOnFirstOccurrence,
  stringToBooleanExact,
  stringToFloat,
  stringToInt,
  stringToKebabCase,
  stringToNumber,
  stringToSlug,
  stringUrlTemplateReplace,
} from '@/shared/utils/string'
import { useValidateSlug } from '@/shared/validators/vuelidate/common/useValidateSlug'

// `stringToInt` is the most imported helper of the library: the admins feed it route params
// (`route.params.id`), query strings and numbers read back from the API.

describe('utils/string', () => {
  describe('stringToInt', () => {
    it('parses a route param', () => {
      expect(stringToInt('42')).toBe(42)
      expect(stringToInt('-7')).toBe(-7)
      expect(stringToInt('007')).toBe(7)
    })

    it('trims surrounding whitespace', () => {
      expect(stringToInt('  42  ')).toBe(42)
      expect(stringToInt('\n12\t')).toBe(12)
    })

    it('falls back for what is not a number', () => {
      expect(stringToInt('')).toBe(0)
      expect(stringToInt('   ')).toBe(0)
      expect(stringToInt('abc')).toBe(0)
      expect(stringToInt(null)).toBe(0)
      expect(stringToInt(undefined)).toBe(0)
      expect(stringToInt(NaN)).toBe(0)
      expect(stringToInt({})).toBe(0)
      expect(stringToInt([])).toBe(0)
    })

    it('honours a custom fallback, including a falsy one', () => {
      expect(stringToInt('abc', 5)).toBe(5)
      expect(stringToInt(undefined, -1)).toBe(-1)
      expect(stringToInt('3', -1)).toBe(3)
    })

    it('does not throw on a value parseInt cannot coerce', () => {
      expect(stringToInt(Symbol('x'), 9)).toBe(9)
    })

    it('reads a number as its integer part', () => {
      expect(stringToInt(12)).toBe(12)
      expect(stringToInt(12.9)).toBe(12)
      expect(stringToInt(-12.9)).toBe(-12)
    })

    // parseInt semantics, kept on purpose: a param like `12-slug` resolves to its id.
    it('reads the leading digits of a mixed string (parseInt semantics)', () => {
      expect(stringToInt('12abc')).toBe(12)
      expect(stringToInt('12-some-slug')).toBe(12)
      expect(stringToInt('1e3')).toBe(1)
      expect(stringToInt('0x1A')).toBe(0)
      expect(stringToInt('1_000')).toBe(1)
    })

    it('keeps large ids that are still safe integers', () => {
      expect(stringToInt('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER)
      expect(stringToInt('2147483648')).toBe(2147483648)
    })

    // Documents parseInt's stringification: a number that prints in exponent form reads as its
    // mantissa. Not a realistic id, but a trap for anyone passing a computed number.
    it('reads a number printed in exponent form as its mantissa (parseInt semantics)', () => {
      expect(stringToInt(1e21)).toBe(1)
      expect(stringToInt(0.0000001)).toBe(1)
    })

    it('returns -0 for "-0" (parseInt semantics)', () => {
      expect(Object.is(stringToInt('-0'), -0)).toBe(true)
    })
  })

  describe('stringToFloat', () => {
    it('parses a dot-decimal value', () => {
      expect(stringToFloat('48.1486')).toBe(48.1486)
      expect(stringToFloat(' -17.1077 ')).toBe(-17.1077)
      expect(stringToFloat(3.5)).toBe(3.5)
    })

    it('falls back for what is not a number', () => {
      expect(stringToFloat('')).toBe(0)
      expect(stringToFloat(null, 1.5)).toBe(1.5)
      expect(stringToFloat('abc', -1)).toBe(-1)
      expect(stringToFloat(Symbol('x'), 2)).toBe(2)
    })

    // A Slovak keyboard types a decimal comma; parseFloat stops at it. Documented, not fixed:
    // callers (GeoLocation in admin-inhouse) must normalise the comma themselves.
    it('stops at a decimal comma', () => {
      expect(stringToFloat('48,1486')).toBe(48)
    })

    it('reads Infinity as Infinity (parseFloat semantics)', () => {
      expect(stringToFloat('Infinity')).toBe(Infinity)
    })
  })

  describe('stringToNumber', () => {
    it('parses a whole trimmed string', () => {
      expect(stringToNumber('42')).toBe(42)
      expect(stringToNumber(' 4.5 ')).toBe(4.5)
      expect(stringToNumber('-0.25')).toBe(-0.25)
      expect(stringToNumber('1e3')).toBe(1000)
    })

    it('rejects partial numbers, unlike stringToInt', () => {
      expect(stringToNumber('12abc')).toBeNull()
      expect(stringToNumber('4,5')).toBeNull()
    })

    it('answers null or the fallback for empty and non-finite input', () => {
      expect(stringToNumber('')).toBeNull()
      expect(stringToNumber('   ')).toBeNull()
      expect(stringToNumber('', 0)).toBe(0)
      expect(stringToNumber('Infinity')).toBeNull()
      expect(stringToNumber('NaN', 7)).toBe(7)
    })

    it('keeps a fallback of 0 rather than treating it as absent', () => {
      expect(stringToNumber('x', 0)).toBe(0)
    })

    // Number() reads hex and binary literals: surprising for a user-typed value, but intended by
    // the strict "whole string is a number" contract.
    it('reads hex and binary literals (Number semantics)', () => {
      expect(stringToNumber('0x10')).toBe(16)
      expect(stringToNumber('0b11')).toBe(3)
    })
  })

  describe('stringToBooleanExact', () => {
    it('answers only the two exact spellings', () => {
      expect(stringToBooleanExact('true')).toBe(true)
      expect(stringToBooleanExact(' false ')).toBe(false)
      expect(stringToBooleanExact('TRUE')).toBeNull()
      expect(stringToBooleanExact('1')).toBeNull()
      expect(stringToBooleanExact('')).toBeNull()
      // admin-cms feeds it `route.query.versions + ''`
      expect(stringToBooleanExact('undefined')).toBeNull()
    })
  })

  describe('stringSplitOnFirstOccurrence', () => {
    it('splits on the first delimiter only', () => {
      expect(stringSplitOnFirstOccurrence('article.texts.title', '.')).toEqual({
        start: 'article',
        end: 'texts.title',
      })
      expect(stringSplitOnFirstOccurrence('cms_article_kind', '_')).toEqual({ start: 'cms', end: 'article_kind' })
    })

    it('handles a multi-character delimiter', () => {
      expect(stringSplitOnFirstOccurrence('a::b::c', '::')).toEqual({ start: 'a', end: 'b::c' })
    })

    it('handles a delimiter at either edge', () => {
      expect(stringSplitOnFirstOccurrence('.title', '.')).toEqual({ start: '', end: 'title' })
      expect(stringSplitOnFirstOccurrence('title.', '.')).toEqual({ start: 'title', end: '' })
    })

    // The form fields take `end` of a vuelidate `$path` for their label; a top-level rule has no
    // dot, and the label must still read the whole path.
    it('keeps the whole value as end when the delimiter is missing', () => {
      expect(stringSplitOnFirstOccurrence('title', '.').end).toBe('title')
    })

    it('does not truncate start when the delimiter is missing', () => {
      // bookmarksStore reads `start` as the system of `systemResource`
      expect(stringSplitOnFirstOccurrence('title', '.').start).toBe('title')
    })

    it('splits nothing off with the default empty delimiter', () => {
      expect(stringSplitOnFirstOccurrence('abc')).toEqual({ start: '', end: 'abc' })
    })
  })

  describe('stringToSlug', () => {
    it('slugs a Slovak headline', () => {
      expect(stringToSlug('Žltý kôň úpäl ďábelské ódy')).toBe('zlty-kon-upal-dabelske-ody')
      expect(stringToSlug('Ľadová ŤAŽBA v Ružomberku')).toBe('ladova-tazba-v-ruzomberku')
    })

    it('slugs Czech and Hungarian diacritics', () => {
      expect(stringToSlug('Příliš žluťoučký kůň')).toBe('prilis-zlutoucky-kun')
      expect(stringToSlug('Győr Szőlő')).toBe('gyor-szolo')
    })

    it('collapses whitespace, dashes and punctuation', () => {
      expect(stringToSlug('  Voľby 2026 – výsledky  ')).toBe('volby-2026-vysledky')
      expect(stringToSlug('Hello,   World!')).toBe('hello-world')
      expect(stringToSlug('a -- b')).toBe('a-b')
      expect(stringToSlug('---a---')).toBe('a')
      expect(stringToSlug('Tom & Jerry')).toBe('tom-jerry')
      expect(stringToSlug('line\nbreak\ttab')).toBe('line-break-tab')
    })

    it('answers an empty string for input with nothing sluggable', () => {
      expect(stringToSlug('')).toBe('')
      expect(stringToSlug('   ')).toBe('')
      expect(stringToSlug('!!!')).toBe('')
      expect(stringToSlug('😀')).toBe('')
    })

    it('handles decomposed input the same as precomposed', () => {
      expect(stringToSlug('Žltý')).toBe('zlty')
    })

    // Documented: punctuation inside a word is dropped, not turned into a separator.
    it('drops dots and apostrophes inside words', () => {
      expect(stringToSlug("Don't stop")).toBe('dont-stop')
      expect(stringToSlug('Ing. Novák')).toBe('ing-novak')
    })

    // The library's own slug validator only allows a-z, 0-9 and "-"; whatever `stringToSlug` makes
    // has to pass it, or an auto-generated slug blocks the save.
    it('produces a slug the slug validator accepts', () => {
      const slug = useValidateSlug()
      for (const input of ['snake_case_title', 'A_B', 'Žltý kôň', 'Tom & Jerry']) {
        const out = stringToSlug(input)
        expect(slug.$validator(out, {}, {}), `"${input}" -> "${out}"`).toBe(true)
      }
    })

    // Letters that do not decompose under NFD are dropped rather than transliterated. Person and
    // author slugs are made from full names (admin-cms), where Polish and German names occur.
    it('transliterates letters that NFD does not decompose', () => {
      expect(stringToSlug('Łukasz Żółć')).toBe('lukasz-zolc')
      expect(stringToSlug('Straße')).toBe('strasse')
      expect(stringToSlug('Đoković')).toBe('dokovic')
      expect(stringToSlug('Øresund')).toBe('oresund')
    })
  })

  describe('stringToKebabCase', () => {
    it('kebabs the camelCase discriminators the admins pass', () => {
      expect(stringToKebabCase('articleList')).toBe('article-list')
      expect(stringToKebabCase('trendingArticleList')).toBe('trending-article-list')
      expect(stringToKebabCase('linkedListItemKindArticle')).toBe('linked-list-item-kind-article')
      expect(stringToKebabCase('box')).toBe('box')
    })

    it('treats a digit as the end of a word', () => {
      expect(stringToKebabCase('foo1Bar')).toBe('foo1-bar')
    })

    it('leaves kebab and empty input alone', () => {
      expect(stringToKebabCase('already-kebab')).toBe('already-kebab')
      expect(stringToKebabCase('')).toBe('')
    })

    // Documented: an initial capital and every capital of an acronym get their own dash. The
    // `Kebab<T>` type computes the same, so this is the contract, not an accident.
    it('prefixes a dash for PascalCase and splits acronyms per letter', () => {
      expect(stringToKebabCase('FooBar')).toBe('-foo-bar')
      expect(stringToKebabCase('seoURL')).toBe('seo-u-r-l')
    })
  })

  describe('stringUrlTemplateReplace', () => {
    it('replaces each colon parameter', () => {
      expect(stringUrlTemplateReplace('/adm/v1/article/:id/edit', { id: 5 })).toBe('/adm/v1/article/5/edit')
      expect(stringUrlTemplateReplace('/:system/:subject', { system: 'cms', subject: 'box' })).toBe('/cms/box')
    })

    it('returns a template without parameters unchanged', () => {
      expect(stringUrlTemplateReplace('/adm/v1/article', { id: 5 })).toBe('/adm/v1/article')
    })

    it('leaves a parameter with no value in place', () => {
      expect(stringUrlTemplateReplace('/a/:id/:other', { id: 1 })).toBe('/a/1/:other')
    })

    it('keeps the query string and does not replace inside it', () => {
      expect(stringUrlTemplateReplace('/a/:id?x=:id', { id: 3 })).toBe('/a/3?x=:id')
    })

    it('replaces a falsy value', () => {
      expect(stringUrlTemplateReplace('/a/:id/:name', { id: 0, name: '' })).toBe('/a/0/')
    })

    it('does not touch a scheme or a port', () => {
      expect(stringUrlTemplateReplace('http://host:8080/a/:id', { id: 1 })).toBe('http://host:8080/a/1')
    })
  })

  describe('stringIsValidEmail', () => {
    it('accepts ordinary addresses', () => {
      expect(stringIsValidEmail('jan.novak@petitpress.sk')).toBe(true)
      expect(stringIsValidEmail('a_b-c@sub.domain.co.uk')).toBe(true)
    })

    it('rejects what is not an address', () => {
      expect(stringIsValidEmail('')).toBe(false)
      expect(stringIsValidEmail('plain')).toBe(false)
      expect(stringIsValidEmail('a@b')).toBe(false)
      expect(stringIsValidEmail('a@b.c')).toBe(false)
      expect(stringIsValidEmail(' a@b.sk')).toBe(false)
      expect(stringIsValidEmail('mailto:a@b.sk')).toBe(false)
      expect(stringIsValidEmail('https://example.com/@user')).toBe(false)
    })

    // admin-cms decides with it whether a link a user typed into the editor becomes `mailto:`.
    // Plus-addressing is common, and such an address must not be turned into a web URL.
    it('accepts plus-addressing', () => {
      expect(stringIsValidEmail('jan.novak+newsletter@gmail.com')).toBe(true)
    })
  })
})
