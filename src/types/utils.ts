type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...0[]]

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never

export type ObjectPaths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, ObjectPaths<T[K], Prev[D]>> : never
      }[keyof T]
    : ''

export type ObjectLeaves<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
    ? { [K in keyof T]-?: Join<K, ObjectLeaves<T[K], Prev[D]>> }[keyof T]
    : ''

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type UniqueValues<T extends Record<string, any>> = {
  [K in keyof T]: Exclude<T[K], T[Exclude<keyof T, K>]>
}

export function ensureUniqueValues<T extends Record<string, any>>(obj: UniqueValues<T>): UniqueValues<T> {
  return obj
}
