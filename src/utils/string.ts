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

export const trimLength = (value: string, maxLength = 80): string => {
  if (value.length > maxLength) {
    return value.substring(1, maxLength) + '...'
  }

  return value
}
