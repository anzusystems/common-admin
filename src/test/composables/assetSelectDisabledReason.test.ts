/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { resolveDisabledReason } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import {
  DamAssetType,
  type AssetSearchListItemDto,
  type AssetSingleUseUsage,
  type DamAssetTypeType,
} from '@/types/coreDam/Asset'
import type { DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'
import type { AssetSelectabilityOptions } from '@/services/stores/coreDam/assetSelectStore'

type Selectability = Pick<AssetSelectabilityOptions, 'singleUseAllowed' | 'uploadLicence'>

const asset = (
  singleUse: boolean,
  usage: Partial<AssetSingleUseUsage> | null = null,
  assetType: DamAssetTypeType = DamAssetType.Image,
) =>
  ({
    attributes: { assetType },
    mainFile: { flags: { singleUse } },
    singleUseUsage: usage
      ? { totalCount: 1, otherHolderCount: 0, blocked: false, places: [], ...usage }
      : null,
  }) as unknown as AssetSearchListItemDto

const options = (partial: Partial<Selectability>): Selectability => ({
  singleUseAllowed: true,
  uploadLicence: undefined,
  ...partial,
})

const agencyLicence: DamAssetLicenceCached = {
  id: 7,
  name: 'Agentúrne fotografie',
  badge: 'AG',
  flags: { directUseAllowed: false },
}

const reason = (key: string) => `common.assetSelect.disabledReason.${key}`

describe('resolveDisabledReason', () => {
  it.each<
    [
      string,
      AssetSearchListItemDto,
      DamAssetLicenceCached | undefined,
      Selectability,
      string | null,
    ]
  >([
    [
      'single use photo blocked by another holder',
      asset(true, { blocked: true, otherHolderCount: 1 }),
      undefined,
      options({}),
      reason('singleUseBlocked'),
    ],
    [
      'single use photo used elsewhere in warn mode',
      asset(true, { totalCount: 2, otherHolderCount: 1, blocked: false }),
      undefined,
      options({}),
      null,
    ],
    ['unused single use photo', asset(true), undefined, options({}), null],
    [
      'single use not allowed for the subject',
      asset(true),
      undefined,
      options({ singleUseAllowed: false }),
      reason('singleUseNotAllowed'),
    ],
    [
      'single use not allowed wins over blocked',
      asset(true, { blocked: true, otherHolderCount: 1 }),
      undefined,
      options({ singleUseAllowed: false }),
      reason('singleUseNotAllowed'),
    ],
    [
      'photo that is not single use ignores the single use rules',
      asset(false, { blocked: true, otherHolderCount: 1 }),
      undefined,
      options({ singleUseAllowed: false }),
      null,
    ],
    [
      'agency video without direct use',
      asset(false, null, DamAssetType.Video),
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
