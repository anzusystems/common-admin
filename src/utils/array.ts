export const arrayItemToggle = <T>(array: Array<T>, value: T) => {
  const index = array.indexOf(value)
  if (index === -1) {
    array.push(value)
    return
  }
  array.splice(index, 1)
}

export const arrayToString = (values: Array<string | number>, separator = ', ') => values.join(separator)

export const arrayFromArgs = <T>(...args: [T[]]) => Array.from(...args)

export type NestedArray<T> = Array<NestedArray<T> | T>

export const arrayFlatten = <T>(input: NestedArray<T>, acc: T[] = []): T[] => {
  return input.reduce((_: T[], current) => {
    if (Array.isArray(current)) return arrayFlatten(current, acc)
    acc.push(current)
    return acc
  }, [])
}
