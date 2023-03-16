import { isAnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { isAnzuFatalError } from '@/model/error/AnzuFatalError'
import { isAnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'

export function useErrors() {
  return {
    isAnzuFatalError,
    isAnzuApiForbiddenError,
    isAnzuApiValidationError,
    isAnzuApiResponseCodeError,
  }
}
