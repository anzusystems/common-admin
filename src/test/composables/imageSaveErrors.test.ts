import { describe, expect, it } from 'vitest'
import type { ComposerTranslation } from 'vue-i18n'
import { resolveImageSaveErrorMessage } from '@/components/damImage/composables/imageSaveErrors'
import type { ImageSaveErrorInfo, KnownReason } from '@/components/damImage/uploadQueue/api/imageApiCms'

// Locale messages are not loaded here, so `t` echoes the key and its arguments; the branching is
// this resolver's job, the rendered sentence is vue-i18n's.
const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key} ${JSON.stringify(args)}` : key) as unknown as ComposerTranslation

const singleUse = (info: Omit<ImageSaveErrorInfo, 'code'>): ImageSaveErrorInfo => ({
  code: 'image_single_use_violation',
  ...info,
})

const DAM_ID = '0d584443-2718-470a-b9b1-92d2d9c7447c'

describe('resolveImageSaveErrorMessage', () => {
  it('ignores errors that are not image save errors', () => {
    expect(resolveImageSaveErrorMessage(undefined, t)).toBeUndefined()
  })

  it('tells a permanent take over refusal apart from an unavailable DAM', () => {
    expect(resolveImageSaveErrorMessage({ code: 'image_take_over_failed', reason: 'take_over_rejected' }, t)).toBe(
      'common.damImage.image.error.takeOverRejected'
    )
    expect(resolveImageSaveErrorMessage({ code: 'image_take_over_failed', reason: 'take_over_exception' }, t)).toBe(
      'common.damImage.image.error.takeOverUnavailable'
    )
    expect(resolveImageSaveErrorMessage({ code: 'image_take_over_failed' }, t)).toBe(
      'common.damImage.image.error.takeOverUnavailable'
    )
  })

  it('names an owner conflict', () => {
    expect(resolveImageSaveErrorMessage({ code: 'image_owner_conflict' }, t)).toBe(
      'common.damImage.image.error.ownerConflict'
    )
  })

  it.each<[KnownReason, string]>([
    ['shared_gallery', 'sharedGallery'],
    ['invalid_owner', 'invalidOwner'],
    ['owner_immutable', 'ownerImmutable'],
    ['image_removed', 'imageRemoved'],
    ['multiple_targets', 'multipleTargets'],
  ])('names the problem, not a photo, for reason %s', (reason, key) => {
    // These reasons carry a damId only sometimes; the message must not depend on it.
    expect(resolveImageSaveErrorMessage(singleUse({ reason, damId: DAM_ID }), t)).toBe(
      `common.damImage.image.error.${key}`
    )
  })

  it('names the source holder when a copy is refused', () => {
    expect(
      resolveImageSaveErrorMessage(
        singleUse({ reason: 'single_use_copy', damId: DAM_ID, holderResourceName: 'articleKindStandard' }),
        t
      )
    ).toBe(`common.damImage.image.error.singleUseCopy {"damId":"${DAM_ID}","holder":"articleKindStandard"}`)
  })

  it('falls back to the conflict wording when a copy refusal cannot name the holder', () => {
    expect(resolveImageSaveErrorMessage(singleUse({ reason: 'single_use_copy', damId: DAM_ID }), t)).toBe(
      `common.damImage.image.error.singleUseViolationUnknownHolder {"damId":"${DAM_ID}"}`
    )
  })

  it('picks the wording by what the server could identify', () => {
    const conflict = (info: Omit<ImageSaveErrorInfo, 'code' | 'reason'>) =>
      resolveImageSaveErrorMessage(singleUse({ reason: 'exclusivity_conflict', ...info }), t)

    expect(conflict({ damId: DAM_ID, holderResourceName: 'gallery' })).toBe(
      `common.damImage.image.error.singleUseViolation {"damId":"${DAM_ID}","holder":"gallery"}`
    )
    expect(conflict({ damId: DAM_ID, holderResourceName: '' })).toBe(
      `common.damImage.image.error.singleUseViolationUnknownHolder {"damId":"${DAM_ID}"}`
    )
    expect(conflict({ holderResourceName: 'gallery' })).toBe(
      'common.damImage.image.error.singleUseViolationUnknownImage {"holder":"gallery"}'
    )
    expect(conflict({})).toBe('common.damImage.image.error.singleUseViolationUnidentified')
  })
})
