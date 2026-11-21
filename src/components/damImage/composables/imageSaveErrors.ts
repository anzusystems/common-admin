import type { ComposerTranslation } from 'vue-i18n'
import type { ImageSaveErrorInfo, KnownSingleUseReason } from '@/components/damImage/uploadQueue/api/imageApiCms'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

const SINGLE_USE_REASON_MESSAGE: Partial<Record<KnownSingleUseReason, string>> = {
  shared_gallery: 'common.damImage.image.error.sharedGallery',
  invalid_owner: 'common.damImage.image.error.invalidOwner',
  gallery_copy: 'common.damImage.image.error.galleryCopy',
  restore_conflict: 'common.damImage.image.error.restoreConflict',
}

export function resolveImageSaveErrorMessage(
  errorInfo: ImageSaveErrorInfo | undefined,
  t: ComposerTranslation,
): string | undefined {
  if (errorInfo?.code === 'image_take_over_failed') {
    return errorInfo.reason === 'take_over_rejected'
      ? t('common.damImage.image.error.takeOverRejected')
      : t('common.damImage.image.error.takeOverUnavailable')
  }
  if (errorInfo?.code !== 'image_single_use_violation') {
    return undefined
  }

  const fixedMessage = errorInfo.reason
    ? SINGLE_USE_REASON_MESSAGE[errorInfo.reason as KnownSingleUseReason]
    : undefined
  if (fixedMessage) {
    return t(fixedMessage)
  }

  const damId = errorInfo.damId ?? ''
  const holder = errorInfo.holderResourceName ? resolveHolderName(errorInfo.holderResourceName) : ''

  if (errorInfo.reason === 'single_use_copy' && damId && holder) {
    return t('common.damImage.image.error.singleUseCopy', { damId, holder })
  }
  if (!damId) {
    return holder
      ? t('common.damImage.image.error.singleUseViolationUnknownImage', { holder })
      : t('common.damImage.image.error.singleUseViolationUnidentified')
  }
  return holder
    ? t('common.damImage.image.error.singleUseViolation', { damId, holder })
    : t('common.damImage.image.error.singleUseViolationUnknownHolder', { damId })
}
