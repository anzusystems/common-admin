import { UrlParams } from '@/services/api/apiHelper'
import { isUndefined } from '@/utils/common'

export const toInt = (value: any, fallbackValue = 0): number => {
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

export const toFloat = (value: any, fallbackValue = 0): number => {
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

export const splitOnFirstOccurrence = (value: string, delimiter = '') => {
  const index = value.indexOf(delimiter)

  return {
    start: value.slice(0, index),
    end: value.slice(index + delimiter.length),
  }
}

export const slugify = (value: string) => {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/&/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

type Kebab<T extends string, A extends string = ''> = T extends `${infer F}${infer R}`
  ? Kebab<R, `${A}${F extends Lowercase<F> ? '' : '-'}${Lowercase<F>}`>
  : A

export const toKebabCase = <T extends string>(value: T): Kebab<T> =>
  value.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase() as Kebab<T>

export const trimLength = (value: string, maxLength = 80): string => {
  if (value.length > maxLength) {
    return value.substring(1, maxLength) + '...'
  }

  return value
}

/**
 * Converts colon parameters to real values.
 *
 * @param template url containing colon parameters, example: '/:id/edit'
 * @param params object containing real values to be replaced, example: { id:5 }
 */
export const urlTemplateReplace = (template: string, params: UrlParams) => {
  if (template.indexOf(':') === -1) return template
  const newParts: string[] = []
  const parts = template.split('/')
  parts.forEach((part, index) => {
    newParts[index] = part
    if (!part.startsWith(':')) return
    const key = part.substring(1)
    if (!isUndefined(params[key])) newParts[index] = params[part.substring(1)] + ''
  })
  return newParts.join('/')
}

/**
 * Slot names with dots are not valid, Vue takes dots as modifiers, so we must replace dots with dash.
 */
export const normalizeForSlotName = (name: string) => name.replace('.', '-')
