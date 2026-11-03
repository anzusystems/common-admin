/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { resolveDisabledReason } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import type { AssetSelectabilityOptions } from '@/services/stores/coreDam/assetSelectStore'
import {
  DamAssetType,
  type AssetSearchListItemDto,
  type DamAssetTypeType,
} from '@/types/coreDam/Asset'
import type { DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'

const asset = (
  singleUse: boolean,
  holderName = '',
  holderId = '',
  assetType: DamAssetTypeType = DamAssetType.Image,
) =>
  ({
    attributes: { assetType },
    mainFile: {
      flags: { singleUse },
      fileAttributes: { usedByHolderName: holderName, usedByHolderId: holderId },
    },
  }) as unknown as AssetSearchListItemDto

const options = (partial: Partial<AssetSelectabilityOptions>): AssetSelectabilityOptions => ({
  singleUseAllowed: true,
  uploadLicence: undefined,
  holder: null,
  ...partial,
})

const agencyLicence: DamAssetLicenceCached = {
  id: 7,
  name: 'Agentúrne fotografie',
  badge: 'AG',
  flags: { manualUploadAllowed: false, directUseAllowed: false, singleUseEnforced: false },
}

const minutePost = { resourceName: 'minutePost', resourceId: '1' }
const article = { resourceName: 'articleKindStandard', resourceId: '41' }
const reason = (key: string) => `common.assetSelect.disabledReason.${key}`

describe('resolveDisabledReason', () => {
  it.each<
    [
      string,
      AssetSearchListItemDto,
      DamAssetLicenceCached | undefined,
      AssetSelectabilityOptions,
      string | null,
    ]
  >([
    [
      'photo held by an article while picking for a minute post',
      asset(true, 'articleKindStandard', '41'),
      undefined,
      options({ holder: minutePost }),
      reason('singleUseHeld'),
    ],
    [
      'photo held by the subject being edited',
      asset(true, 'minutePost', '1'),
      undefined,
      options({ holder: minutePost }),
      null,
    ],
    [
      'photo held by another record of the same resource',
      asset(true, 'minutePost', '2'),
      undefined,
      options({ holder: minutePost }),
      reason('singleUseHeld'),
    ],
    [
      'free use picks a photo held elsewhere',
      asset(true, 'articleKindStandard', '41'),
      undefined,
      options({ holder: null }),
      null,
    ],
    [
      'single use not allowed even for its own holder',
      asset(true, 'articleKindStandard', '41'),
      undefined,
      options({ singleUseAllowed: false, holder: article }),
      reason('singleUseNotAllowed'),
    ],
    [
      'single use not allowed in free use',
      asset(true, 'articleKindStandard', '41'),
      undefined,
      options({ singleUseAllowed: false }),
      reason('singleUseNotAllowed'),
    ],
    [
      'stale holder after the licence stopped enforcing single use',
      asset(false, 'articleKindStandard', '41'),
      undefined,
      options({ holder: minutePost }),
      null,
    ],
    ['unused single use photo', asset(true), undefined, options({ holder: minutePost }), null],
    [
      'agency video without direct use',
      asset(false, '', '', DamAssetType.Video),
      agencyLicence,
      options({ uploadLicence: 3 }),
      reason('directUseDisabledNotImage'),
    ],
    [
      'agency photo without an upload licence',
      asset(false),
      agencyLicence,
      options({}),
      reason('directUseDisabledNoUploadLicence'),
    ],
    [
      'agency photo taken over into the upload licence',
      asset(false),
      agencyLicence,
      options({ uploadLicence: 3 }),
      null,
    ],
  ])('%s', (_name, item, licence, selectability, expected) => {
    expect(resolveDisabledReason(item, licence, selectability)).toBe(expected)
  })
})
