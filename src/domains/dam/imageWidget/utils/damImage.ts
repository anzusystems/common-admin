import { applyImageOwner, type ImageCreateUpdateAware, type ImageOwner } from '@/domains/dam/types/ImageAware'
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

/**
 * What an image save of a widget sends (`imageFieldsOf`), with the record the image belongs to (`owner`, left out when
 * none) and the upload licence core-cms takes a picked photo of another licence over into. The image is not changed.
 */
export function imageSaveFieldsOf(
  image: ImageCreateUpdateAware,
  owner: ImageOwner | null | undefined,
  uploadLicence: IntegerId
): ImageCreateUpdateAware {
  const fields = imageFieldsOf(image)
  fields.dam = { ...fields.dam, uploadLicenceId: uploadLicence }
  return applyImageOwner(fields, owner)
}

// Every path the DAM serves an image file on: the original, any crop (`w800-h450`, `-c1`, `-q80`) and an animation.
const DAM_IMAGE_URL_FILE_ID =
  /\/image\/(?:original|animated|w\d+-h\d+(?:-c\d+)?(?:-q\d+)?)\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.(?:jpg|gif)(?:[?#]|$)/i

/**
 * File id from a DAM image URL, whatever crop it shows; undefined for any other URL.
 */
export function damImageFileIdFromUrl(url: string): DocId | undefined {
  return url.match(DAM_IMAGE_URL_FILE_ID)?.[1]
}
