import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus, type AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'

const NOT_PROCESSED_YET: AssetFileProcessStatusType[] = [
  AssetFileProcessStatus.Uploading,
  AssetFileProcessStatus.Uploaded,
  AssetFileProcessStatus.Stored,
]

/**
 * The server may yet fill in the metadata of the asset from its file: a form loaded now would write over that when
 * saved, and a save marks the asset described, after which the server fills in nothing. Not an asset that is
 * described already, nor one whose file is processed, failed, a duplicate or not there: nothing more comes of those.
 */
export const assetMetadataMayStillChange = (asset: AssetDetailItemDto) =>
  !asset.flags.described && !!asset.mainFile && NOT_PROCESSED_YET.includes(asset.mainFile.fileAttributes.status)
