export const toggleArrayItem = <T>(array: Array<T>, value: T) => {
  const index = array.indexOf(value)
  if (index === -1) {
    array.push(value)
    return
  }
  array.splice(index, 1)
}

export const arrayToString = (values: number[] | string[], separator = ', ') => values.join(separator)

// @ts-ignore todo
export const arrayFromArgs = (...args: any) => Array.from(...args)

// @ts-ignore todo
export const flattenArray = (arr) => {
  // @ts-ignore todo
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten)
  }, [])
}
