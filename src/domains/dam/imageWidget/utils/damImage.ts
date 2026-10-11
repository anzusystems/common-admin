import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

export interface DamImageFile {
  fileId: DocId
  licenceId: IntegerId
  /** `mainFileInternal` of the asset; false where it is not known. */
  internal?: boolean | null
}

/**
 * The image of the CMS for a file of the DAM. `position` and `id` are keys of the image only where they are given,
 * 0 included: what a caller sends has the keys it had when it built the object by hand. A text is empty where the
 * caller names none, and otherwise as handed, whatever a mapping of the application made of it.
 */
export function createDamImage(
  file: DamImageFile,
  texts: { description?: string; source?: string } = {},
  options: { showSource?: boolean; position?: number; id?: IntegerId } = {}
): ImageCreateUpdateAware {
  const image: ImageCreateUpdateAware = {
    texts: { description: '', source: '', ...texts },
    flags: { showSource: options.showSource ?? true, internal: false, overrideInternal: false },
    dam: { damId: file.fileId, licenceId: file.licenceId, regionPosition: 0, internal: file.internal ?? false },
  }
  if (!isUndefined(options.position)) image.position = options.position
  if (!isUndefined(options.id)) image.id = options.id
  return image
}

/**
 * What the image API is sent of an image: its own fields. A widget carries more with it (the asset and the authors
 * an upload was mapped from, the key and the authors of a row of the gallery), which no backend reads.
 */
export function imageFieldsOf(image: ImageCreateUpdateAware): ImageCreateUpdateAware {
  const fields: ImageCreateUpdateAware = { texts: image.texts, flags: image.flags, dam: image.dam }
  if (!isUndefined(image.position)) fields.position = image.position
  if (!isUndefined(image.id)) fields.id = image.id
  return fields
}
