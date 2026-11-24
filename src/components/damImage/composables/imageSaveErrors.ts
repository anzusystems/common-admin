import type { ComposerTranslation } from 'vue-i18n'
import {
  ImageSaveErrorCode,
  type ImageSaveErrorInfo,
  ImageSaveErrorReason,
  type ImageSaveErrorReasonType,
} from '@/components/damImage/uploadQueue/api/imageApiCms'
import { resolveHolderLabel } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

const SINGLE_USE_REASON_MESSAGE: Partial<Record<ImageSaveErrorReasonType, string>> = {
  [ImageSaveErrorReason.SharedGallery]: 'common.damImage.image.error.sharedGallery',
  [ImageSaveErrorReason.InvalidOwner]: 'common.damImage.image.error.invalidOwner',
  [ImageSaveErrorReason.GalleryCopy]: 'common.damImage.image.error.galleryCopy',
}

export function resolveImageSaveErrorMessage(
  errorInfo: ImageSaveErrorInfo | undefined,
  t: ComposerTranslation,
): string | undefined {
  if (errorInfo?.code === ImageSaveErrorCode.TakeOverFailed) {
    return errorInfo.reason === ImageSaveErrorReason.TakeOverRejected
      ? t('common.damImage.image.error.takeOverRejected')
      : t('common.damImage.image.error.takeOverUnavailable')
  }
  if (errorInfo?.code !== ImageSaveErrorCode.SingleUseViolation) {
    return undefined
  }

  const fixedMessage = errorInfo.reason
    ? SINGLE_USE_REASON_MESSAGE[errorInfo.reason]
    : undefined
  if (fixedMessage) {
    return t(fixedMessage)
  }

  const damId = errorInfo.damId ?? ''
  const holder = errorInfo.holderResourceName ? resolveHolderLabel(errorInfo.holderResourceName) : ''
  const key =
    errorInfo.reason === ImageSaveErrorReason.RestoreConflict
      ? 'common.damImage.image.error.restoreConflict'
      : 'common.damImage.image.error.singleUseViolation'

  if (!damId) {
    return holder ? t(`${key}UnknownImage`, { holder }) : t(`${key}Unidentified`)
  }
  return holder ? t(key, { damId, holder }) : t(`${key}UnknownHolder`, { damId })
}
