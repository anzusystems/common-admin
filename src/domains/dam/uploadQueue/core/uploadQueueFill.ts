import type { CustomDataValue } from '@/domains/customDataForm/types/CustomDataForm'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import type { DocId } from '@/shared/types/common'
import { isArray, isNull, isUndefined } from '@/shared/utils/common'

// The mass operations of an upload queue, over the rows they are given. They read only `assetType`, `customData`,
// `keywords` and `authors` of a row. Public as `uploadQueueFillCustomDataValue`, `…Keywords`, `…Authors`.
// Each filled row gets a list of its own (Z24): one list shared by the rows, and by the form it came from, would
// change in all of them with an edit of any.

/** Only into the rows of the asset type of the field. */
export function fillCustomDataValue(
  items: UploadQueueItem[],
  data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue },
  forceReplace = false
) {
  for (const item of items) {
    if (item.assetType !== data.assetType) continue
    const current = item.customData[data.elementProperty]
    // `null` is how a value saved empty comes back; a field of several values is empty as an empty list.
    const empty = isUndefined(current) || isNull(current) || current === '' || (isArray(current) && !current.length)
    if (forceReplace || empty) {
      item.customData[data.elementProperty] = isArray(data.value) ? data.value.slice() : data.value
    }
  }
}

/** `accepts`: the rows that may take them; without it, every row. */
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

/** `accepts`: the rows that may take them; without it, every row. */
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
