import axios from 'axios'
import { HTTP_STATUS_FORBIDDEN } from '@/composables/statusCodes'

export const axiosErrorResponseIsForbidden = (error: Error) => {
  return axios.isAxiosError(error) && error.response?.status === HTTP_STATUS_FORBIDDEN
}

export const isAnzuApiForbiddenError = (error: any): error is AnzuApiForbiddenError => {
  return error instanceof AnzuApiForbiddenError
}

export class AnzuApiForbiddenError extends Error {
  constructor(cause?: Error, message = '') {
    super(message)
    this.name = 'AnzuApiForbiddenError'
    this.cause = cause
    this.message = message
  }
}
