import { ref } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'

/**
 * The two log stores every anzu backend exposes.
 * A runtime value on purpose: the router guard validates the `:type`
 * segment before any component mounts, and a TypeScript type is erased.
 * The dropdown iterates the same object the guard checks, so they cannot drift apart.
 */
export const LogType = {
  App: 'app',
  Audit: 'audit',
} as const
export type LogTypeType = (typeof LogType)[keyof typeof LogType]
export const LogTypeDefault = LogType.App

export const isLogType = (value: unknown): value is LogTypeType => Object.values(LogType).includes(value as LogTypeType)

/**
 * Full paths per type, not a segment on a shared prefix.
 * brick exposes its app log at `/adm/v1/log/journal`, not `/adm/v1/log/app`, and other backends may differ elsewhere.
 */
export type LogPaths = Record<LogTypeType, string>

export const DEFAULT_LOG_PATHS: LogPaths = {
  app: '/adm/v1/log/app',
  audit: '/adm/v1/log/audit',
}

export function useLogType() {
  // Raw `app` / `audit` titles, as every admin shows them.
  // `common.log.filter.type` is the select's label. One translation cannot title two options.
  const logTypeOptions = ref<ValueObjectOption<LogTypeType>[]>(
    Object.values(LogType).map((value) => ({ value, title: value }))
  )

  const getLogTypeOption = (value: LogTypeType) => {
    return logTypeOptions.value.find((item) => item.value === value)
  }

  return {
    logTypeOptions,
    getLogTypeOption,
  }
}
