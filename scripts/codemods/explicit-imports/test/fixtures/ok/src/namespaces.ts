interface ref {
  value: number
}
export const count: ref = ref(1)

type computed = number
export const doubled: computed = 2
export const derived = computed(() => doubled)

class Ref {}
export const instance: Ref = new Ref()

enum ComputedRef {
  A,
}
export const member = ComputedRef.A

export function generic<shallowRef>(value: shallowRef) {
  return [value, shallowRef(0)]
}

namespace watch {
  export const x = 1
}
export const fromNamespace = watch.x
