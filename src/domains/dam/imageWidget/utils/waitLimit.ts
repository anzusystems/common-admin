import { coreDamOptions } from '@/plugins/pluginOptions'
import { isNumber } from '@/shared/utils/common'

/** What a wait that has run out answers. */
export const WAIT_RAN_OUT = Symbol('wait ran out')

const DEFAULT_LIMIT_SECONDS = 30

/**
 * `wait`, for at most the time the application gives a request to the DAM (`coreDam.apiTimeout`, in seconds; 30 where
 * it gives none), once for each of the `requests` it is made of, one after another. What a widget waits for may be a
 * request of another widget, or several in a row, and a client without a time limit of its own never ends a request
 * that does not answer: the widget waited on, without an end.
 */
export const withinWaitLimit = <T>(wait: Promise<T>, requests = 1): Promise<T | typeof WAIT_RAN_OUT> => {
  const seconds = coreDamOptions.value?.apiTimeout
  const limit = (isNumber(seconds) && seconds > 0 ? seconds : DEFAULT_LIMIT_SECONDS) * 1000 * requests
  let timer: ReturnType<typeof setTimeout> | undefined
  const ranOut = new Promise<typeof WAIT_RAN_OUT>((resolve) => {
    timer = setTimeout(() => resolve(WAIT_RAN_OUT), limit)
  })
  return Promise.race([wait, ranOut]).finally(() => clearTimeout(timer))
}
