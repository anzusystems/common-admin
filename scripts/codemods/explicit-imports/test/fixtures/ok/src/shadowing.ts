export function parameter(ref: number) {
  return ref + 1
}

export function nested() {
  const computed = 1
  return computed
}

export function caught() {
  try {
    return 0
  } catch (unref) {
    return unref
  }
}

export function loop(list: number[]) {
  for (const watch of list) void watch
}

export function destructured(options: { reactive: number; other: number }) {
  const { reactive, ...rest } = options
  return [reactive, rest]
}

export const beforeDeclaration = () => shallowRef(later)
const later = 1

export const used = () => toRaw({})
