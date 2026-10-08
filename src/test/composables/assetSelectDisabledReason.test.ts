import { describe, expect, it } from 'vitest'
import { resolveDisabledReason } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import type { AssetSelectabilityOptions } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

const heldAsset = (holderName: string, holderId: string) =>
  ({
    attributes: { assetType: 'image' },
    mainFile: {
      flags: { singleUse: true },
      fileAttributes: { usedByHolderName: holderName, usedByHolderId: holderId },
    },
  }) as unknown as AssetSearchListItemDto

const options = (partial: Partial<AssetSelectabilityOptions>): AssetSelectabilityOptions => ({
  singleUseAllowed: true,
  uploadLicence: undefined,
  holder: null,
  ...partial,
})

describe('resolveDisabledReason single use', () => {
  const heldByArticle = heldAsset('articleKindStandard', 'a')

  it('claim: a tile held by another holder is disabled, one held by me is selectable', () => {
    const me = { resourceName: 'minutePost', resourceId: '1' }

    expect(resolveDisabledReason(heldByArticle, undefined, options({ holder: me }))).toContain('singleUseHeld')
    expect(resolveDisabledReason(heldAsset('minutePost', '1'), undefined, options({ holder: me }))).toBeNull()
  })

  it('free: a tile held by someone else is selectable', () => {
    expect(resolveDisabledReason(heldByArticle, undefined, options({ holder: null }))).toBeNull()
  })

  it('forbidden: a single use tile is disabled whatever the holder', () => {
    const me = { resourceName: 'articleKindStandard', resourceId: 'a' }

    expect(resolveDisabledReason(heldByArticle, undefined, options({ singleUseAllowed: false, holder: me }))).toContain(
      'singleUseNotAllowed'
    )
    expect(resolveDisabledReason(heldByArticle, undefined, options({ singleUseAllowed: false }))).toContain(
      'singleUseNotAllowed'
    )
  })
})
