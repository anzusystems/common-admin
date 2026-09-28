import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref, type Ref } from 'vue'
import useVuelidate, { type Validation } from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { i18n } from '@/plugins/i18n'
import en from '@/locales/en'
import sk from '@/locales/sk'

// The validators translate through the library's own i18n instance (`@/plugins/i18n`), which the
// admins fill via `useLanguageSettings`. The test fills it the same way.
beforeAll(() => {
  i18n.global.setLocaleMessage('en', en as never)
  i18n.global.setLocaleMessage('sk', sk as never)
  i18n.global.locale.value = 'en'
})

type Rules = Record<string, unknown>

/** Mounts a component that runs vuelidate over `state` with `rules`, and hands back `v$`. */
const setup = <S extends Record<string, unknown>>(state: Ref<S>, rules: Rules | (() => Rules)) => {
  let v$!: Ref<Validation>
  mount(
    defineComponent({
      setup() {
        v$ = useVuelidate(
          computed(() => (typeof rules === 'function' ? rules() : rules)),
          state,
          { $autoDirty: true }
        ) as unknown as Ref<Validation>
        return () => null
      },
    })
  )
  return v$
}

const field = (v$: Ref<Validation>, name = 'value') => (v$.value as any)[name]

const messages = async (v$: Ref<Validation>, name = 'value') => {
  field(v$, name).$touch()
  await nextTick()
  return field(v$, name).$errors.map((e: { $message: string }) => e.$message)
}

describe('useValidate', () => {
  const v = useValidate()

  it('exposes every validator', () => {
    expect(Object.keys(v).sort()).toEqual(
      [
        'between',
        'datesCompare',
        'email',
        'hexColor',
        'maxLength',
        'maxValue',
        'minLength',
        'minValue',
        'numeric',
        'required',
        'requiredIf',
        'slug',
        'stringArrayItemLength',
        'url',
      ].sort()
    )
  })

  describe('required / requiredIf', () => {
    it('rejects empty values with a translated message', async () => {
      for (const empty of ['', '   ', null, undefined, []]) {
        const v$ = setup(ref({ value: empty }), { value: { required: v.required } })
        expect(await messages(v$), JSON.stringify(empty)).toEqual(['Required.'])
      }
    })

    it('accepts 0 and false', async () => {
      for (const value of [0, false, 'x']) {
        const v$ = setup(ref({ value }), { value: { required: v.required } })
        expect(await messages(v$)).toEqual([])
      }
    })

    it('translates to Slovak', async () => {
      i18n.global.locale.value = 'sk'
      try {
        const v$ = setup(ref({ value: '' }), { value: { required: v.required } })
        expect(await messages(v$)).toEqual(['Povinná hodnota.'])
      } finally {
        i18n.global.locale.value = 'en'
      }
    })

    it('requiredIf follows a ref', async () => {
      const when = ref(false)
      const v$ = setup(ref({ value: '' }), { value: { requiredIf: v.requiredIf(when) } })
      expect(await messages(v$)).toEqual([])
      when.value = true
      expect(await messages(v$)).toEqual(['Required.'])
    })
  })

  describe('length and value bounds', () => {
    it('interpolates the bound', async () => {
      const v$ = setup(ref({ value: 'ab' }), { value: { minLength: v.minLength(3) } })
      expect(await messages(v$)).toEqual(['Minimal length is 3.'])
      const w$ = setup(ref({ value: 'abcd' }), { value: { maxLength: v.maxLength(3) } })
      expect(await messages(w$)).toEqual(['Maximal length is 3.'])
      const x$ = setup(ref({ value: 0 }), { value: { minValue: v.minValue(1) } })
      expect(await messages(x$)).toEqual(['Minimal value must be 1.'])
      const y$ = setup(ref({ value: 11 }), { value: { maxValue: v.maxValue(10) } })
      expect(await messages(y$)).toEqual(['Maximal value must be 10.'])
      const z$ = setup(ref({ value: 11 }), { value: { between: v.between(1, 10) } })
      expect(await messages(z$)).toEqual(['Value must be between 1 and 10.'])
    })

    it('accepts the bounds themselves', async () => {
      const v$ = setup(ref({ a: 'abc', b: 1, c: 10 }), {
        a: { minLength: v.minLength(3), maxLength: v.maxLength(3) },
        b: { between: v.between(1, 10) },
        c: { between: v.between(1, 10) },
      })
      await v$.value.$validate()
      expect(v$.value.$errors).toEqual([])
    })

    it('counts characters, not bytes, for diacritics', async () => {
      const v$ = setup(ref({ value: 'žťč' }), { value: { maxLength: v.maxLength(3) } })
      expect(await messages(v$)).toEqual([])
    })

    it('reads a ref bound, and prints its current value', async () => {
      const max = ref(3)
      const v$ = setup(ref({ value: 'abcd' }), { value: { maxLength: v.maxLength(max) } })
      expect(await messages(v$)).toEqual(['Maximal length is 3.'])
      max.value = 5
      expect(await messages(v$)).toEqual([])
    })

    it('leaves an empty optional value alone', async () => {
      const v$ = setup(ref({ value: '' }), { value: { minLength: v.minLength(3), minValue: v.minValue(1) } })
      expect(await messages(v$)).toEqual([])
    })
  })

  describe('format validators', () => {
    const check = async (rule: unknown, value: unknown) => {
      const v$ = setup(ref({ value }), { value: { rule } })
      return (await messages(v$)).length === 0
    }

    it('email', async () => {
      expect(await check(v.email, 'jan.novak@petitpress.sk')).toBe(true)
      expect(await check(v.email, 'jan+tag@gmail.com')).toBe(true)
      expect(await check(v.email, '')).toBe(true)
      expect(await check(v.email, 'jan@')).toBe(false)
      expect(await check(v.email, 'jan novak@x.sk')).toBe(false)
    })

    it('url', async () => {
      expect(await check(v.url, 'https://www.sme.sk/c/123')).toBe(true)
      expect(await check(v.url, 'https://žilina.sk')).toBe(true)
      expect(await check(v.url, '')).toBe(true)
      expect(await check(v.url, 'sme.sk')).toBe(false)
      expect(await check(v.url, 'javascript:alert(1)')).toBe(false)
    })

    // Documented (vuelidate's `url`): no private hosts or bare host names.
    it('url rejects localhost and private addresses', async () => {
      expect(await check(v.url, 'http://localhost:3000')).toBe(false)
      expect(await check(v.url, 'http://192.168.1.10/x')).toBe(false)
    })

    it('numeric', async () => {
      expect(await check(v.numeric, '12')).toBe(true)
      expect(await check(v.numeric, '12.5')).toBe(true)
      expect(await check(v.numeric, 12)).toBe(true)
      expect(await check(v.numeric, '12a')).toBe(false)
    })

    // Documented (vuelidate's `numeric`): digits only, so a sign or a decimal comma fails.
    it('numeric rejects a sign and a decimal comma', async () => {
      expect(await check(v.numeric, '-1')).toBe(false)
      expect(await check(v.numeric, '1,5')).toBe(false)
    })

    it('slug', async () => {
      expect(await check(v.slug, 'zlty-kon-2026')).toBe(true)
      expect(await check(v.slug, '')).toBe(true)
      expect(await check(v.slug, 'Zlty')).toBe(false)
      expect(await check(v.slug, 'žltý')).toBe(false)
      expect(await check(v.slug, 'a b')).toBe(false)
      expect(await check(v.slug, 'a_b')).toBe(false)
    })

    it('hexColor', async () => {
      expect(await check(v.hexColor, '#3f6AD8')).toBe(true)
      expect(await check(v.hexColor, '')).toBe(true)
      expect(await check(v.hexColor, '#fff')).toBe(false)
      expect(await check(v.hexColor, '3f6ad8')).toBe(false)
      expect(await check(v.hexColor, '#GGGGGG')).toBe(false)
      expect(await check(v.hexColor, '#3f6ad8ff')).toBe(false)
    })

    it('formats have translated messages', async () => {
      const v$ = setup(ref({ a: 'x', b: 'x', c: 'x', d: 'X', e: 'x' }), {
        a: { email: v.email },
        b: { url: v.url },
        c: { numeric: v.numeric },
        d: { slug: v.slug },
        e: { hexColor: v.hexColor },
      })
      await v$.value.$validate()
      expect(v$.value.$errors.map((e) => e.$message)).toEqual([
        'Incorrect email format.',
        'Incorrect url format.',
        'Allowed only numbers.',
        'Allowed only characters a-z and numbers 0-9.',
        'Colour must be in the #RRGGBB format.',
      ])
    })
  })

  describe('stringArrayItemLength', () => {
    it('checks every item', async () => {
      const state = ref({ value: ['ab', 'abcde'] })
      const v$ = setup(state, { value: { len: v.stringArrayItemLength(2, 5) } })
      expect(await messages(v$)).toEqual([])
      state.value.value = ['ab', 'a']
      expect(await messages(v$)).toEqual(['Item length in list must have between 2 and 5 characters.'])
      state.value.value = ['abcdef']
      expect(await messages(v$)).toHaveLength(1)
    })

    it('leaves an empty or absent list alone', async () => {
      for (const value of [[], null, undefined]) {
        const v$ = setup(ref({ value }), { value: { len: v.stringArrayItemLength(1, 5) } })
        expect(await messages(v$)).toEqual([])
      }
    })

    it('reads ref bounds', async () => {
      const max = ref(2)
      const v$ = setup(ref({ value: ['abc'] }), { value: { len: v.stringArrayItemLength(1, max as never) } })
      expect(await messages(v$)).toEqual(['Item length in list must have between 1 and 2 characters.'])
      max.value = 3
      expect(await messages(v$)).toEqual([])
    })
  })

  describe('datesCompare', () => {
    const since = '2026-03-29T01:00:00.000000Z'
    const later = '2026-03-29T01:00:00.000001Z'

    const compare = async (value: string | null, other: string | null, variant: string) => {
      const otherRef = ref(other)
      const v$ = setup(ref({ value }), {
        value: { cmp: v.datesCompare(otherRef, 'Published since', variant as never) },
      })
      return messages(v$)
    }

    it('orders the four variants', async () => {
      const after = '2026-03-29T02:00:00.000000Z'
      expect(await compare(after, since, 'laterThan')).toEqual([])
      expect(await compare(since, since, 'laterThan')).toEqual(['Date must be later than "Published since"'])
      expect(await compare(since, since, 'onOrAfter')).toEqual([])
      expect(await compare(since, after, 'onOrAfter')).toHaveLength(1)
      expect(await compare(since, after, 'earlierThan')).toEqual([])
      expect(await compare(since, since, 'earlierThan')).toEqual(['Date must be earlier than "Published since"'])
      expect(await compare(since, since, 'onOrBefore')).toEqual([])
      expect(await compare(after, since, 'onOrBefore')).toEqual(['Date must be on or before "Published since"'])
    })

    it('passes when either side is empty', async () => {
      expect(await compare(null, since, 'laterThan')).toEqual([])
      expect(await compare(since, null, 'laterThan')).toEqual([])
      expect(await compare(null, null, 'laterThan')).toEqual([])
    })

    it('compares values of different fraction length by instant', async () => {
      expect(await compare('2026-03-29T01:00:00Z', since, 'onOrAfter')).toEqual([])
      expect(await compare('2026-03-29T01:00:00.000Z', since, 'laterThan')).toHaveLength(1)
    })

    // Documented: Date keeps milliseconds only, so microseconds do not order.
    it('does not order microseconds', async () => {
      expect(await compare(later, since, 'laterThan')).toHaveLength(1)
    })

    it('re-validates when the other date changes', async () => {
      const other = ref<string | null>('2026-01-01T00:00:00.000000Z')
      const v$ = setup(ref({ value: '2026-06-01T00:00:00.000000Z' }), {
        value: { cmp: v.datesCompare(other, 'Start', 'laterThan') },
      })
      expect(await messages(v$)).toEqual([])
      other.value = '2026-12-01T00:00:00.000000Z'
      expect(await messages(v$)).toEqual(['Date must be later than "Start"'])
    })

    it('translates the message per variant', async () => {
      i18n.global.locale.value = 'sk'
      try {
        expect(await compare(since, since, 'laterThan')).toEqual(['Dátum musí byť vyšší ako "Published since"'])
      } finally {
        i18n.global.locale.value = 'en'
      }
    })
  })
})
