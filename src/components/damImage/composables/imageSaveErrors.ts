import { useAlerts } from '@/composables/system/alerts'
import { type ComposerTranslation, useI18n } from 'vue-i18n'
import {
  extractImageSaveErrorInfo,
  type ImageSaveErrorInfo,
} from '@/components/damImage/uploadQueue/api/imageApiCms'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

/**
 * Single place turning an `image_single_use_violation`/`image_take_over_failed` 422 into a message —
 * used by every widget that can create/update an `Image` (§6c: this is the last-resort path, the
 * picker's disabled reasons are meant to prevent most of these before the save even happens).
 */
export function resolveImageSaveErrorMessage(
  errorInfo: ImageSaveErrorInfo | undefined,
  t: ComposerTranslation,
): string | undefined {
  if (errorInfo?.code === 'image_take_over_failed') {
    return t('common.damImage.image.error.takeOverFailed')
  }
  if (errorInfo?.code === 'image_single_use_violation') {
    switch (errorInfo.reason) {
      case 'exclusivity_conflict':
        return t('common.damImage.image.error.exclusivityConflict', {
          // Empty when the holder cannot be named, e.g. a gallery shared by two articles.
          holder: errorInfo.holderResourceName
            ? resolveHolderName(errorInfo.holderResourceName)
            : errorInfo.holderResourceId,
        })
      case 'shared_gallery':
        return t('common.damImage.image.error.sharedGallery')
      case 'invalid_owner':
        return t('common.damImage.image.error.invalidOwner')
      case 'owner_immutable':
        return t('common.damImage.image.error.ownerImmutable')
      case 'image_removed':
        return t('common.damImage.image.error.imageRemoved')
      default:
        return t('common.damImage.image.error.singleUseViolation')
    }
  }
  return undefined
}

export function useImageSaveErrorMessage() {
  const { showErrorsDefault, showError } = useAlerts()
  const { t } = useI18n()

  const showImageSaveError = (e: unknown) => {
    const message = resolveImageSaveErrorMessage(extractImageSaveErrorInfo(e), t)
    if (!message) {
      showErrorsDefault(e)
      return
    }
    showError(message)
  }

  return { showImageSaveError }
}
