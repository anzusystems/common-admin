import { HTTP_STATUS_VALID_ALL } from '@/shared/statusCodes'

export const isValidHTTPStatus = (statusCode: number) => {
  return HTTP_STATUS_VALID_ALL.includes(statusCode)
}
