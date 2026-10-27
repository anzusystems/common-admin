import axios, { type AxiosError } from 'axios'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError, axiosErrorIsCancelled } from '@/shared/error/AnzuApiCancelledError'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/shared/error/AnzuApiDependencyExistsError'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/shared/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/shared/error/AnzuApiForbiddenOperationError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/shared/error/AnzuApiTimeoutError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/shared/error/AnzuApiValidationError'
import { AnzuError, isAnzuError } from '@/shared/error/AnzuError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '@/shared/statusCodes'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'

export type ApiErrorContext = {
  system: string
  entity: string
  /**
   * The url actually requested, with parameters substituted and query included. Not the template.
   */
  url?: string
  /**
   * The status the backend answered with. Absent for a transport failure.
   * The application's logger uses it to decide what to record, for example a 404 that a caller probes for.
   * The library itself handles 401 and 403, because they concern the
   * session and not the endpoint. Every other status reaches the logger.
   */
  status?: number
  /**
   * The i18n scope for field-level validation errors, when it differs from the backend above.
   * `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` translation keys. A component
   * shared by several backends reports which backend failed but uses the library's `common.*` labels.
   * If unset, the backend value is used.
   */
  validationSystem?: string
  validationEntity?: string
}

export type ApiErrorLogger = (error: Error, context: ApiErrorContext) => void

/**
 * Entity name of the user probe in the error context.
 * A 404 from the probe means the user has no account, so the default logger skips it. App loggers
 * should filter on this and the status, not the url, which would also silence a real detail read.
 * The validation scope stays the user's, so field errors still resolve real labels.
 * Defined here to avoid an import cycle with the default logger.
 */
export const USER_PROBE_ENTITY = 'anzuUserProbe'

/**
 * Default error reporting. Exported so tests can restore it.
 */
export const defaultApiErrorLogger: ApiErrorLogger = (error, context) => {
  if (context.status === 404 && context.entity === USER_PROBE_ENTITY) return
  console.error('Api error: ' + (context.url ?? ''), error)
}

let logger: ApiErrorLogger | null = defaultApiErrorLogger

/**
 * Replaces the logger the api helpers report unexpected failures through. `null` turns reporting off.
 * One global switch for all helpers, so reporting does not depend on which helper made the call.
 * @example setApiErrorLogger((e, ctx) => Sentry.captureException(e, { extra: ctx }))
 */
export const setApiErrorLogger = (fn: ApiErrorLogger | null): void => {
  logger = fn
}

// Only unplanned failures. Validation and forbidden errors are shown to the user by the caller.
// Logging them too would be noise.
const LOGGED = [AnzuApiAxiosError, AnzuFatalError, AnzuApiResponseCodeError]

/**
 * HTTP status from the axios response of `AnzuApiAxiosError` or the `code` of `AnzuApiResponseCodeError`.
 * `undefined` when nothing answered: timeout, network failure, cancel.
 */
export const apiErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof AnzuApiResponseCodeError) return error.code
  if (error instanceof AnzuApiAxiosError) return error.cause.response?.status

  return undefined
}

/**
 * Whether `report` passes this error to the logger. False for a timeout, 401, 403, or while reporting is off.
 * Lets a caller that reports only the first failure of a series start the series at the first logged one.
 */
export const apiErrorIsReported = (error: unknown): boolean => {
  const status = apiErrorStatus(error)
  // 401 and 403 are session states, not endpoint failures. Every
  // admin checks for 401 on startup, so logging it adds noise.
  // Checked by status, not by class. A rejected 403 becomes `AnzuApiForbiddenError` (not in `LOGGED`).
  // A fulfilled 403 allowed by `options.validateStatus` becomes `AnzuApiResponseCodeError` (in `LOGGED`).
  // This is not configurable on purpose. Apps can filter other statuses like 404 or 409 via the `status` field.
  if (status === HTTP_STATUS_UNAUTHORIZED || status === HTTP_STATUS_FORBIDDEN) return false
  // Same as a 401, caught before the request: the refresh found the session gone.
  if (isInCauseChain(error, (cause) => cause instanceof SessionExpiredError)) return false

  return logger !== null && LOGGED.some((cls) => error instanceof cls)
}

/**
 * Reports a mapped error once and returns it so the caller can throw it.
 * Runs after mapping because errors the helper raises itself are
 * already `Anzu*` classes and would bypass a logger inside the mapping.
 */
export const report = <E>(error: E, context: ApiErrorContext): E => {
  if (logger !== null && apiErrorIsReported(error)) {
    try {
      // Status is added here because only the mapped error knows it.
      // The caller built the context before looking at the error.
      logger(error as unknown as Error, { ...context, status: apiErrorStatus(error) })
    } catch {
      // A logger that throws must not replace the failure the caller is waiting for.
    }
  }

  return error
}

/**
 * Turns whatever axios rejected with into an Anzu error class.
 * Shared by all helpers. The order of checks decides the class,
 * so separate copies would map the same failure differently.
 */
export const mapApiError = (err: unknown, context: ApiErrorContext): AnzuError => {
  const { system, entity } = context
  const labelSystem = context.validationSystem ?? system
  const labelEntity = context.validationEntity ?? entity
  // Casts only satisfy the predicate signatures. Each predicate checks its input itself.
  const error = err as Error
  const axiosError = err as AxiosError

  // Already mapped, including contract errors raised by a helper.
  // Wrapping again would hide the class the caller branches on.
  if (isAnzuError(err)) return err

  // Checked first because a cancelled request is not a failure. The caller stopped it.
  if (axiosErrorIsCancelled(err)) return new AnzuApiCancelledError(error)

  // Use the rendered url, not `config.url`. `config.url` is relative and has no params.
  // It would become this error's `message`, unlike every other error that uses `requestedUrl`.
  if (axiosErrorResponseIsForbidden(axiosError)) return new AnzuApiForbiddenError(axiosError, context.url)

  if (axiosErrorResponseHasValidationData(axiosError)) {
    return new AnzuApiValidationError(axiosError, labelSystem, labelEntity, error)
  }

  if (axiosErrorResponseHasDependencyExistsData(axiosError)) {
    return new AnzuApiDependencyExistsError(axiosError, labelSystem, labelEntity, error)
  }

  if (axiosErrorResponseHasForbiddenOperationData(axiosError)) {
    return new AnzuApiForbiddenOperationError(axiosError, error)
  }

  if (axiosErrorIsTimeout(error)) return new AnzuApiTimeoutError(error)

  if (axios.isAxiosError(err)) return new AnzuApiAxiosError(axiosError)

  return new AnzuFatalError(error)
}
