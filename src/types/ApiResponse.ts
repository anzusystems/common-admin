import { isObject } from '@/utils/common'

export interface ApiResponseList<T> {
  totalCount: number
  data: T
}

export interface ApiInfiniteResponseList<T> {
  hasNextPage: boolean
  data: T
}

export const isApiResponseList = <T>(value: unknown): value is ApiResponseList<T> => {
  return isObject(value) && Object.hasOwn(value, 'totalCount')
}

export const isApiInfiniteResponseList = <T>(value: unknown): value is ApiInfiniteResponseList<T> => {
  return isObject(value) && Object.hasOwn(value, 'hasNextPage')
}
