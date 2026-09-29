export const arrayItemToggle = <T>(array: Array<T>, value: T) => {
  const index = array.indexOf(value)
  if (index === -1) {
    array.push(value)
    return
  }
  array.splice(index, 1)
}

export const arrayFromArgs = <T>(...args: [T[]]) => Array.from(...args)

export type NestedArray<T> = Array<NestedArray<T> | T>

export const arrayFlatten = <T>(input: NestedArray<T>, acc: T[] = []): T[] => {
  for (const current of input) {
    if (Array.isArray(current)) arrayFlatten(current, acc)
    else acc.push(current)
  }
  return acc
}

export const arraysHaveSameElements = <T>(array1: T[], array2: T[]): boolean => {
  if (array1.length !== array2.length) {
    return false
  }

  // Sort both arrays
  const sortedArray1 = array1.slice().sort()
  const sortedArray2 = array2.slice().sort()

  // Compare the sorted arrays
  for (let i = 0; i < sortedArray1.length; i++) {
    if (sortedArray1[i] !== sortedArray2[i]) {
      return false
    }
  }

  return true
}
