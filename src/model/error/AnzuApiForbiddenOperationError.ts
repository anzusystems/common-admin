import axios, { type AxiosError } from 'axios'
import { HTTP_STATUS_UNPROCESSABLE_ENTITY } from '@/composables/statusCodes'

interface ForbiddenOperationResponseData {
  contextId: string
  error: string
  detail: string
}

const ERROR_FORBIDDEN_OPERATION = 'forbidden_operation_error'

export const axiosErrorResponseHasForbiddenOperationData = (error: Error) => {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY &&
    error.response.data?.error === ERROR_FORBIDDEN_OPERATION &&
    error.response.data?.detail
  )
}

export const isAnzuApiForbiddenOperationError = (error: any): error is AnzuApiForbiddenOperationError => {
  return error instanceof AnzuApiForbiddenOperationError
}

function resolveResponseData(axiosError: AxiosError) {
  const data = axiosError.response?.data as ForbiddenOperationResponseData
  return data.detail
}

export class AnzuApiForbiddenOperationError extends Error {
  detail: string

  constructor(axiosError: AxiosError, cause?: Error, message = '') {
    super(message)
    this.name = 'AnzuApiForbiddenOperationError'
    this.cause = cause
    this.message = message
    this.detail = resolveResponseData(axiosError)
  }
}
