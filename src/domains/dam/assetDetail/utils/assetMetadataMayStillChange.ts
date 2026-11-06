import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus, type AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'

const NOT_PROCESSED_YET: AssetFileProcessStatusType[] = [
  AssetFileProcessStatus.Uploading,
  AssetFileProcessStatus.Uploaded,
  AssetFileProcessStatus.Stored,
]

/**
 * True while the server may still fill the metadata from the file.
 * A form loaded now would overwrite that on save. A save also
 * marks the asset described, after which the server fills nothing.
 * False when already described, or when the file is processed, failed, a duplicate or missing.
 */
export const assetMetadataMayStillChange = (asset: AssetDetailItemDto) =>
  !asset.flags.described && !!asset.mainFile && NOT_PROCESSED_YET.includes(asset.mainFile.fileAttributes.status)
