import type { LogLevelType } from '@/model/valueObject/LogLevel'
import type { DatetimeUTC, IntegerIdNullable } from '@/types/common'

export interface Log {
  id: string
  message: string
  datetime: DatetimeUTC
  levelName: LogLevelType
  context: {
    appVersion: string
    appSystem: string
    requestOriginAppVersion: string
    path: string
    method: string
    contextId: string
    userId: IntegerIdNullable
    ip: string
    response: string
    content?: string
    params: string
    httpStatus: number
  }
  _resourceName: string
  _system: string
  _type: string
}
