import { describe, expect, it } from 'vitest'
import { splitAssetsForCopyToLicence } from '@/components/damImage/uploadQueue/composables/splitAssetsForCopyToLicence'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { IntegerId } from '@/types/common'

const TARGET_LICENCE = 10
const OTHER_LICENCE = 20

const asset = (id: string, licence: IntegerId, withMainFile = true) =>
  ({
    id,
    licence,
    mainFile: withMainFile ? { id: `file-${id}` } : null,
  }) as unknown as AssetSearchListItemDto

const ids = (assets: AssetSearchListItemDto[]) => assets.map((item) => item.id)

describe('splitAssetsForCopyToLicence', () => {
  it.each<[string, AssetSearchListItemDto[], IntegerId | undefined, string[], string[]]>([
    [
      'copy switched off adds every asset',
      [asset('a1', TARGET_LICENCE), asset('b1', OTHER_LICENCE)],
      undefined,
      [],
      ['a1', 'b1'],
    ],
    [
      'every asset outside the target licence is copied',
      [asset('b1', OTHER_LICENCE), asset('b2', OTHER_LICENCE)],
      TARGET_LICENCE,
      ['b1', 'b2'],
      [],
    ],
    [
      'a mixed choice copies only the assets outside the target licence',
      [asset('b1', OTHER_LICENCE), asset('a1', TARGET_LICENCE), asset('b2', OTHER_LICENCE)],
      TARGET_LICENCE,
      ['b1', 'b2'],
      ['a1'],
    ],
    [
      'every asset in the target licence is added without a copy',
      [asset('a1', TARGET_LICENCE), asset('a2', TARGET_LICENCE)],
      TARGET_LICENCE,
      [],
      ['a1', 'a2'],
    ],
    [
      'an asset without a main file is neither copied nor added',
      [asset('b1', OTHER_LICENCE, false), asset('a1', TARGET_LICENCE, false)],
      TARGET_LICENCE,
      [],
      [],
    ],
  ])('%s', (_name, assets, targetLicence, expectedToCopy, expectedToAdd) => {
    const { toCopy, toAdd } = splitAssetsForCopyToLicence(assets, targetLicence)

    expect(ids(toCopy)).toEqual(expectedToCopy)
    expect(ids(toAdd)).toEqual(expectedToAdd)
  })
})
