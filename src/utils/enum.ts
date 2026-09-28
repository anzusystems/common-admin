export function isOneOf<T>(value: T, enumValues: T[]): boolean {
  return enumValues.includes(value)
}
