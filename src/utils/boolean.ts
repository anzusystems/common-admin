import { isNumber, isString } from '@/utils/common.ts'

export const booleanToInteger = (value: boolean) => {
  return value ? 1 : 0
}

export const parseBoolean = (x: unknown): boolean => {
  if (x === true) return true
  if (!x) return false
  if (!isString(x) && !isNumber(x)) return false
  const str = `${x}`.toUpperCase().trim()

  return !['FALSE', 'NO', '0'].includes(str)
}
