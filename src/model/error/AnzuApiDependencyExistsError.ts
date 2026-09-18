import axios, { type AxiosError } from 'axios'
import { HTTP_STATUS_UNPROCESSABLE_ENTITY } from '@/composables/statusCodes'

export interface AnzuApiDependencyExistsResponseData {
  contextId: string
  error: string
  dependencies: string[]
}

const ERROR_VALIDATION = 'dependency_exists_error'

export const axiosErrorResponseHasDependencyExistsData = (error: Error) => {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY &&
    error.response.data?.error === ERROR_VALIDATION &&
    error.response.data?.dependencies
  )
}

export const isAnzuApiDependencyExistsError = (error: any): error is AnzuApiDependencyExistsError => {
  return error instanceof AnzuApiDependencyExistsError
}

function resolveResponseData(axiosError: AxiosError) {
  const data = axiosError.response?.data as AnzuApiDependencyExistsResponseData

  return data.dependencies
}

export class AnzuApiDependencyExistsError extends Error {
  dependencies: string[]

  constructor(axiosError: AxiosError, system: string, entity: string, cause?: Error, message = '') {
    super(message)
    this.name = 'AnzuApiDependencyExistsError'
    this.cause = cause
    this.message = message
    this.dependencies = resolveResponseData(axiosError)
  }
}
