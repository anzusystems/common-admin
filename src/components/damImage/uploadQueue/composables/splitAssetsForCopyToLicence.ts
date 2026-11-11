import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { IntegerId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'

export const splitAssetsForCopyToLicence = (
  assets: AssetSearchListItemDto[],
  targetLicence: IntegerId | undefined,
): { toCopy: AssetSearchListItemDto[]; toAdd: AssetSearchListItemDto[] } => {
  const withMainFile = assets.filter((asset) => !isNull(asset.mainFile))
  if (isUndefined(targetLicence)) return { toCopy: [], toAdd: withMainFile }

  return {
    toCopy: withMainFile.filter((asset) => asset.licence !== targetLicence),
    toAdd: withMainFile.filter((asset) => asset.licence === targetLicence),
  }
}
