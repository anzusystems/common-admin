import axios, { type AxiosError } from 'axios'
import { HTTP_STATUS_UNPROCESSABLE_ENTITY } from '@/composables/statusCodes'

interface ValidationResponseDataFields {
  [key: string]: string[]
}

interface ValidationResponseData {
  contextId: string
  error: string
  fields: ValidationResponseDataFields
}

export interface ValidationError {
  field: string
  errors: string[]
}

const ERROR_VALIDATION = 'validation_failed'

export const axiosErrorResponseHasValidationData = (error: Error) => {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY &&
    error.response.data?.error === ERROR_VALIDATION
  )
}

export const isAnzuApiValidationError = (error: any): error is AnzuApiValidationError => {
  return error instanceof AnzuApiValidationError
}

function resolveResponseData(axiosError: AxiosError, system: string, entity: string) {
  const data = axiosError.response?.data as ValidationResponseData
  const items = [] as ValidationError[]
  for (const [key, values] of Object.entries(data.fields)) {
    items.push({
      field: system + '.' + entity + '.model.' + key,
      errors: values,
    })
  }
  return items
}

export class AnzuApiValidationError extends Error {
  fields: ValidationError[]

  constructor(axiosError: AxiosError, system: string, entity: string, cause?: Error, message = '') {
    super(message)
    this.name = 'AnzuApiValidationError'
    this.cause = cause
    this.message = message
    this.fields = resolveResponseData(axiosError, system, entity)
  }
}
