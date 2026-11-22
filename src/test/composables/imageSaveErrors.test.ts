import { describe, expect, it } from 'vitest'
import type { ComposerTranslation } from 'vue-i18n'
import { resolveImageSaveErrorMessage } from '@/components/damImage/composables/imageSaveErrors'
import type { ImageSaveErrorInfo } from '@/components/damImage/uploadQueue/api/imageApiCms'

const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key} ${JSON.stringify(args)}` : key) as unknown as ComposerTranslation

const DAM_ID = '0d584443-2718-470a-b9b1-92d2d9c7447c'
const message = (key: string) => `common.damImage.image.error.${key}`

describe('resolveImageSaveErrorMessage', () => {
  it.each<[string, ImageSaveErrorInfo | undefined, string | undefined]>([
    ['not an image save error', undefined, undefined],
    [
      'DAM refused the take over',
      { code: 'image_take_over_failed', reason: 'take_over_rejected' },
      message('takeOverRejected'),
    ],
    [
      'DAM unavailable during take over',
      { code: 'image_take_over_failed', reason: 'take_over_exception' },
      message('takeOverUnavailable'),
    ],
    [
      'take over failed without a reason',
      { code: 'image_take_over_failed' },
      message('takeOverUnavailable'),
    ],
    [
      'shared gallery',
      { code: 'image_single_use_violation', reason: 'shared_gallery', damId: DAM_ID },
      message('sharedGallery'),
    ],
    [
      'invalid owner',
      { code: 'image_single_use_violation', reason: 'invalid_owner', damId: DAM_ID },
      message('invalidOwner'),
    ],
    [
      'gallery copy',
      { code: 'image_single_use_violation', reason: 'gallery_copy', damId: DAM_ID },
      message('galleryCopy'),
    ],
    [
      'exclusivity conflict with photo and holder',
      {
        code: 'image_single_use_violation',
        reason: 'exclusivity_conflict',
        damId: DAM_ID,
        holderResourceName: 'gallery',
      },
      `${message('singleUseViolation')} {"damId":"${DAM_ID}","holder":"gallery"}`,
    ],
    [
      'exclusivity conflict with an empty holder',
      {
        code: 'image_single_use_violation',
        reason: 'exclusivity_conflict',
        damId: DAM_ID,
        holderResourceName: '',
      },
      `${message('singleUseViolationUnknownHolder')} {"damId":"${DAM_ID}"}`,
    ],
    [
      'exclusivity conflict without a photo',
      {
        code: 'image_single_use_violation',
        reason: 'exclusivity_conflict',
        holderResourceName: 'gallery',
      },
      `${message('singleUseViolationUnknownImage')} {"holder":"gallery"}`,
    ],
    [
      'exclusivity conflict the server could not identify',
      { code: 'image_single_use_violation', reason: 'exclusivity_conflict' },
      message('singleUseViolationUnidentified'),
    ],
  ])('%s', (_name, errorInfo, expected) => {
    expect(resolveImageSaveErrorMessage(errorInfo, t)).toBe(expected)
  })
})
