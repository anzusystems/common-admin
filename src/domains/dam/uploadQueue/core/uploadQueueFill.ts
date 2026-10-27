import type { CustomDataValue } from '@/domains/customDataForm/types/CustomDataForm'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import type { DocId } from '@/shared/types/common'
import { isArray, isNull, isUndefined } from '@/shared/utils/common'

// Bulk operations of an upload queue over the given rows. They
// read only `assetType`, `customData`, `keywords` and `authors`.
// Public as `uploadQueueFillCustomDataValue`, `…Keywords`, `…Authors`.
// Each filled row gets its own list (Z24). A list shared by rows
// and the source form would change in all of them on any edit.

/**
 * Fills only rows of the field's asset type.
 */
export function fillCustomDataValue(
  items: UploadQueueItem[],
  data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue },
  forceReplace = false
) {
  for (const item of items) {
    if (item.assetType !== data.assetType) continue
    const current = item.customData[data.elementProperty]
    // A value saved empty comes back as `null`. A multi-value field is empty as an empty list.
    const empty = isUndefined(current) || isNull(current) || current === '' || (isArray(current) && !current.length)
    if (forceReplace || empty) {
      item.customData[data.elementProperty] = isArray(data.value) ? data.value.slice() : data.value
    }
  }
}

/**
 * `accepts`: rows that may take them. Without it, every row.
 */
export function fillKeywords(
  items: UploadQueueItem[],
  value: DocId[],
  forceReplace = false,
  accepts?: (item: UploadQueueItem) => boolean
) {
  for (const item of items) {
    if (accepts && !accepts(item)) continue
    if (forceReplace || isUndefined(item.keywords) || item.keywords.length === 0) {
      item.keywords = [...value]
    }
  }
}

/**
 * `accepts`: rows that may take them. Without it, every row.
 */
export function fillAuthors(
  items: UploadQueueItem[],
  value: DocId[],
  forceReplace = false,
  accepts?: (item: UploadQueueItem) => boolean
) {
  for (const item of items) {
    if (accepts && !accepts(item)) continue
    if (forceReplace || isUndefined(item.authors) || item.authors.length === 0) {
      item.authors = [...value]
    }
  }
}
