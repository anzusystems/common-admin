import type { UrlParams } from '@/services/api/apiHelper'
import { isUndefined } from '@/utils/common'

export const stringToInt = (value: any, fallbackValue = 0): number => {
  let check = fallbackValue
  try {
    check = Number.parseInt(value, 10)
  } catch {
    return fallbackValue
  }

  if (Number.isNaN(check)) {
    return fallbackValue
  }

  return check
}

export const stringToFloat = (value: any, fallbackValue = 0): number => {
  let check = fallbackValue
  try {
    check = Number.parseFloat(value)
  } catch {
    return fallbackValue
  }

  if (Number.isNaN(check)) {
    return fallbackValue
  }

  return check
}

export const stringToNumber = (value: string, fallbackValue?: number): number | null => {
  const trimmedValue = value.trim()
  if (trimmedValue === '') {
    return fallbackValue !== undefined ? fallbackValue : null
  }
  const numericValue = Number(trimmedValue)
  if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
    return numericValue
  }

  return fallbackValue !== undefined ? fallbackValue : null
}

export const stringToBooleanExact = (value: string): boolean | null => {
  const trimmedValue = value.trim()
  if (trimmedValue === 'true') return true
  if (trimmedValue === 'false') return false
  return null
}

export const stringSplitOnFirstOccurrence = (value: string, delimiter = '') => {
  const index = value.indexOf(delimiter)
  // `end` stays the whole value, which the form fields read as the label path of a top-level rule.
  if (index === -1) return { start: value, end: value }

  return {
    start: value.slice(0, index),
    end: value.slice(index + delimiter.length),
  }
}

// Letters NFD does not decompose into a base letter and a mark.
const SLUG_TRANSLITERATION: Record<string, string> = {
  ł: 'l',
  ß: 'ss',
  đ: 'd',
  ð: 'd',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  þ: 'th',
  ħ: 'h',
  ı: 'i',
}

export const stringToSlug = (value: string) => {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łßđðøæœþħı]/g, (letter) => SLUG_TRANSLITERATION[letter]!)
    .replace(/[\s_]+/g, '-')
    .replace(/&/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

type Kebab<T extends string, A extends string = ''> = T extends `${infer F}${infer R}`
  ? Kebab<R, `${A}${F extends Lowercase<F> ? '' : '-'}${Lowercase<F>}`>
  : A

export const stringToKebabCase = <T extends string>(value: T): Kebab<T> =>
  value.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase() as Kebab<T>

/**
 * Converts colon parameters to real values from params.
 *
 * @param template url containing colon parameters, example: '/:id/edit'
 * @param params object containing real values to be replaced, example: { id:5 }
 */
export const stringUrlTemplateReplace = (template: string, params: UrlParams) => {
  if (template.indexOf(':') === -1) return template
  const newParts: string[] = []
  const [path, queryString] = template.split('?')
  const parts = path!.split('/')
  parts.forEach((part, index) => {
    newParts[index] = part
    if (!part.startsWith(':')) return
    const key = part.substring(1)
    if (!isUndefined(params[key])) newParts[index] = encodeURIComponent(params[key] + '')
  })

  return newParts.join('/') + (queryString ? `?${queryString}` : '')
}

export const stringIsValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/
  return emailRegex.test(email)
}
