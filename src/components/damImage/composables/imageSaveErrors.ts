import { useAlerts } from '@/composables/system/alerts'
import { i18n } from '@/plugins/i18n'
import type { ComposerTranslation } from 'vue-i18n'
import {
  extractImageSaveErrorInfo,
  type ImageSaveErrorInfo,
  type KnownSingleUseReason,
} from '@/components/damImage/uploadQueue/api/imageApiCms'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

// Reasons resolved by a fixed sentence, no damId/holder involved. `exclusivity_conflict` and
// `single_use_copy` are handled separately below, they need the damId/holder in the wording.
const SINGLE_USE_REASON_MESSAGE: Partial<Record<KnownSingleUseReason, string>> = {
  shared_gallery: 'common.damImage.image.error.sharedGallery',
  invalid_owner: 'common.damImage.image.error.invalidOwner',
  owner_immutable: 'common.damImage.image.error.ownerImmutable',
  image_removed: 'common.damImage.image.error.imageRemoved',
  multiple_targets: 'common.damImage.image.error.multipleTargets',
  image_copy: 'common.damImage.image.error.imageCopy',
  gallery_copy: 'common.damImage.image.error.galleryCopy',
}

/**
 * Single place turning an `image_single_use_violation`/`image_take_over_failed` 422 or an `image_owner_conflict`
 * 409 into a message — used by every widget that can create/update an `Image` (§6c: this is the last-resort path, the
 * picker's disabled reasons are meant to prevent most of these before the save even happens).
 *
 * `image_single_use_violation` covers several different problems and only some of them are about one
 * photo, so `reason` decides the wording — naming a photo where there is none to name would describe
 * the wrong thing. When the server could not look the photo or its holder up in DAM it leaves `damId`
 * and `holderResourceName` empty, and every combination gets its own sentence instead of a blank id.
 */
export function resolveImageSaveErrorMessage(
  errorInfo: ImageSaveErrorInfo | undefined,
  t: ComposerTranslation
): string | undefined {
  if (errorInfo?.code === 'image_take_over_failed') {
    // DAM refusing this one photo and DAM being unreachable need opposite advice: picking another
    // image helps in the first case and fails just as certainly in the second.
    return errorInfo.reason === 'take_over_rejected'
      ? t('common.damImage.image.error.takeOverRejected')
      : t('common.damImage.image.error.takeOverUnavailable')
  }
  if (errorInfo?.code === 'image_owner_conflict') {
    return t('common.damImage.image.error.ownerConflict')
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

  // The copy is refused because the photo stays with the source entity, so the wording names its
  // holder instead of telling the editor to release it - releasing it would not make the copy work.
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

// Callers wire this up outside component setup too (module scope of action composables, tiptap paste
// handlers), where `useI18n()` would throw - the global instance is what `useAlerts` reads as well.
export function useImageSaveErrorMessage() {
  const { showErrorsDefault, showError } = useAlerts()
  const { t } = i18n.global

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
