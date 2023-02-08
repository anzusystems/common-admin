import { HTTP_STATUS_VALID_ALL } from '@/composables/statusCodes'

export const isValidHTTPStatus = (statusCode: number) => {
  return HTTP_STATUS_VALID_ALL.includes(statusCode)
}
