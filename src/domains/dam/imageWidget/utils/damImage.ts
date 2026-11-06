import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

export interface DamImageFile {
  fileId: DocId
  licenceId: IntegerId
  /** `mainFileInternal` of the asset; false if unknown. */
  internal?: boolean | null
}

/**
 * CMS image for a DAM file. `position` and `id` are set only when given, including 0, to match hand-built objects.
 * Texts are empty when not given, otherwise used as passed, regardless of application mappings.
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
 * Only the image's own fields for the image API. Widget extras
 * such as asset, authors and row key are not read by any backend.
 */
export function imageFieldsOf(image: ImageCreateUpdateAware): ImageCreateUpdateAware {
  const fields: ImageCreateUpdateAware = { texts: image.texts, flags: image.flags, dam: image.dam }
  if (!isUndefined(image.position)) fields.position = image.position
  if (!isUndefined(image.id)) fields.id = image.id
  return fields
}
