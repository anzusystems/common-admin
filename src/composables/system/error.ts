import axios from 'axios'
import { useAlerts } from '@/composables/system/alerts'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { HTTP_STATUS_UNPROCESSABLE_ENTITY } from '../statusCodes'

interface ValidationResponseDataFields {
  [key: string]: string[]
}

export interface ValidationResponseData {
  contextId: string
  error: string
  fields: ValidationResponseDataFields
}

export interface ApiErrors {
  field: string
  errors: string[]
}

interface Error {
  response?: {
    data?: {
      error?: string
    }
  }
}

const ERROR_MESSAGE = 'validation_failed'

const { showApiError, showUnknownError } = useAlerts()

export function useErrorHandler() {
  const handleValidationError = (error: Error, system = '', entity = '') => {
    if (!error || !error.response || !error.response.data) return
    const data = error.response.data as ValidationResponseData
    const items = [] as ApiErrors[]
    for (const [key, values] of Object.entries(data.fields)) {
      items.push({
        field: system + '.' + entity + '.model.' + key,
        errors: values,
      })
    }
    showApiError(items)
  }

  const isValidationError = (error: Error | any) => {
    if (axios.isAxiosError(error) && error.response && error.response.status === HTTP_STATUS_UNPROCESSABLE_ENTITY) {
      if (error.response.data && error.response.data.error === ERROR_MESSAGE) {
        return true
      }
    }
    return false
  }

  const handleError = (error: unknown) => {
    if (error instanceof AnzuApiValidationError) return
    // todo: add logging / implement context id
    console.error(error)
    showUnknownError()
  }

  return {
    handleError,
    handleValidationError,
    isValidationError,
  }
}
