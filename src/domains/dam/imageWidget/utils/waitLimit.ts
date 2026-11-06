import { coreDamOptions } from '@/plugins/pluginOptions'
import { isNumber } from '@/shared/utils/common'

export const WAIT_RAN_OUT = Symbol('wait ran out')

const DEFAULT_LIMIT_SECONDS = 30

/**
 * Limits `wait` to the DAM request timeout per each of `requests` in sequence:
 * `apiTimeout` of config `configName`, else `coreDam.apiTimeout`, else 30 seconds.
 * The awaited work may be another widget's requests, and a client without its
 * own timeout never ends an unanswered request, so the widget waited forever.
 */
export const withinWaitLimit = <T>(
  wait: Promise<T>,
  requests: number,
  configName: string
): Promise<T | typeof WAIT_RAN_OUT> => {
  const configs = coreDamOptions.value?.configs
  const ofConfig = configs && Object.hasOwn(configs, configName) ? configs[configName]?.apiTimeout : undefined
  const seconds = ofConfig ?? coreDamOptions.value?.apiTimeout
  const limit = (isNumber(seconds) && seconds > 0 ? seconds : DEFAULT_LIMIT_SECONDS) * 1000 * requests
  let timer: ReturnType<typeof setTimeout> | undefined
  const ranOut = new Promise<typeof WAIT_RAN_OUT>((resolve) => {
    timer = setTimeout(() => resolve(WAIT_RAN_OUT), limit)
  })
  return Promise.race([wait, ranOut]).finally(() => clearTimeout(timer))
}
