/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import {
  formatSingleUseUsageCount,
  resolveDisabledReason,
} from '@/domains/dam/assetSelect/composables/assetSelectDisabledReason'
import {
  DamAssetType,
  type AssetSearchListItemDto,
  type AssetSingleUseUsage,
  type DamAssetTypeType,
} from '@/domains/dam/types/Asset'
import type { DamAssetLicenceCached } from '@/domains/dam/types/AssetLicence'
import type { AssetSelectabilityOptions } from '@/domains/dam/assetSelect/store/assetSelectStore'

type Selectability = Pick<AssetSelectabilityOptions, 'uploadLicence'>

const asset = (
  singleUse: boolean,
  usage: Partial<AssetSingleUseUsage> | null = null,
  assetType: DamAssetTypeType = DamAssetType.Image
) =>
  ({
    attributes: { assetType },
    mainFile: { flags: { singleUse } },
    singleUseUsage: usage
      ? { holder: null, status: 'free', blocked: false, usageCount: 0, usages: [], ...usage }
      : null,
  }) as unknown as AssetSearchListItemDto

const options = (partial: Partial<Selectability>): Selectability => ({
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
  it.each<[string, AssetSearchListItemDto, DamAssetLicenceCached | undefined, Selectability, string | null]>([
    [
      'single use photo blocked by another holder',
      asset(true, { status: 'conflict', blocked: true, usageCount: 1 }),
      undefined,
      options({}),
      reason('singleUseBlocked'),
    ],
    [
      'single use photo on an entity that may not use it',
      asset(true, { status: 'notAllowed', blocked: true }),
      undefined,
      options({}),
      reason('singleUseNotAllowed'),
    ],
    ...(['placement', 'free', 'own', 'ownShared'] as const).map(
      (status) =>
        [
          `single use photo with status ${status} is not blocked`,
          asset(true, { status, usageCount: 1 }),
          undefined,
          options({}),
          null,
        ] as [string, AssetSearchListItemDto, undefined, Selectability, string | null]
    ),
    [
      'single use photo used elsewhere in warn mode',
      asset(true, { status: 'conflict', usageCount: 2, blocked: false }),
      undefined,
      options({}),
      null,
    ],
    ['unused single use photo', asset(true), undefined, options({}), null],
    [
      'photo that is not single use ignores the single use rules',
      asset(false, { status: 'conflict', blocked: true, usageCount: 1 }),
      undefined,
      options({}),
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

describe('formatSingleUseUsageCount', () => {
  it.each([
    [1, '1'],
    [10, '10'],
    [11, '10+'],
  ])('%i → %s', (usageCount, expected) => {
    expect(formatSingleUseUsageCount(usageCount)).toBe(expected)
  })
})
