import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'

export const LogLevel = {
  Debug: 'DEBUG',
  Info: 'INFO',
  Notice: 'NOTICE',
  Warning: 'WARNING',
  Error: 'ERROR',
  Critical: 'CRITICAL',
  Alert: 'ALERT',
  Emergency: 'EMERGENCY',
} as const
export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel]
export const LogLevelDefault = LogLevel.Info

export function useLogLevel() {
  const logLevelOptions = ref<ValueObjectOption<LogLevelType>[]>([
    {
      value: LogLevel.Debug,
      title: LogLevel.Debug,
      color: 'blue-grey lighten-5',
    },
    {
      value: LogLevel.Info,
      title: LogLevel.Info,
      color: 'blue-grey lighten-3',
    },
    {
      value: LogLevel.Notice,
      title: LogLevel.Notice,
      color: 'amber lighten-4',
    },
    {
      value: LogLevel.Warning,
      title: LogLevel.Warning,
      color: 'amber',
    },
    {
      value: LogLevel.Error,
      title: LogLevel.Error,
      color: 'red',
    },
    {
      value: LogLevel.Critical,
      title: LogLevel.Critical,
      color: 'red accent-4',
    },
    {
      value: LogLevel.Alert,
      title: LogLevel.Alert,
      color: 'pink',
    },
    {
      value: LogLevel.Emergency,
      title: LogLevel.Emergency,
      color: 'ping darken-4',
    },
  ])

  const getLogLevelOption = (value: LogLevelType) => {
    return logLevelOptions.value.find((item) => item.value === value)
  }

  return {
    logLevelOptions,
    getLogLevelOption,
  }
}
