import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'

/**
 * The two log stores every anzu backend exposes. This is a runtime value on purpose: the router
 * guard validates the `:type` path segment before any component mounts, and a bare TypeScript
 * type is erased by then. It is the single source of the valid set -- the dropdown iterates the
 * same object the guard checks against, so the two cannot drift apart.
 */
export const LogType = {
  App: 'app',
  Audit: 'audit',
} as const
export type LogTypeType = (typeof LogType)[keyof typeof LogType]
export const LogTypeDefault = LogType.App

export const isLogType = (value: unknown): value is LogTypeType => Object.values(LogType).includes(value as LogTypeType)

/**
 * Full paths per type, not a segment appended to a shared prefix: brick exposes its app log at
 * `/adm/v1/log/journal` rather than `/adm/v1/log/app`, and nothing says the next backend will
 * differ in the same place.
 */
export type LogPaths = Record<LogTypeType, string>

export const DEFAULT_LOG_PATHS: LogPaths = {
  app: '/adm/v1/log/app',
  audit: '/adm/v1/log/audit',
}

export function useLogType() {
  // Raw `app` / `audit` titles, as every admin shows them today. `common.log.filter.type` is the
  // select's own label, not a per-option name -- one translation cannot title two options.
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
