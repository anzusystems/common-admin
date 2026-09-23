import type { DocId, DocIdNullable, IntegerId } from '@/types/common'

/**
 * The entity/version that will own this image once saved. Sent as `ownerResourceName/Id` in the
 * create/update payload; the server derives site/siteGroup from it and, for a single-use photo, ties
 * the claim to it. `null` = the entity has no id yet, so a single-use photo cannot be picked at all.
 */
export interface ImageOwner {
  resourceName: string
  resourceId: IntegerId
}

export interface ImageAware {
  id: IntegerId
  texts: {
    description: string
    source: string
  }
  dam: {
    damId: DocId
    licenceId: IntegerId
    regionPosition: number
    internal: boolean
    // Request-only: target site group licence for take-over; server ignores licenceId for that decision.
    uploadLicenceId?: IntegerId
    // Manual override shown only for a directUseAllowed licence that isn't the upload licence.
    forceTakeOver?: boolean
    singleUse?: boolean
    takenOverFromId?: DocIdNullable
  }
  flags: {
    showSource: boolean
    internal: boolean
    overrideInternal: boolean
  }
  position?: number
}

export interface ImageCreateUpdateAware extends Omit<ImageAware, 'id'> {
  id?: IntegerId
  // Request-only: the entity claiming the photo, set at create. On update an omitted pair keeps the stored
  // owner and a different owner is rejected (owner_immutable). Deliberately not on ImageAware: a response
  // carries the stored owner, typed by each app.
  ownerResourceName?: string
  ownerResourceId?: IntegerId
}

export interface ImageCreateUpdateAwareKeyed extends ImageCreateUpdateAware {
  key: string
}

/**
 * Sets the owner request fields from an `ImageOwner`, in place - the one place the `resourceName`/
 * `resourceId` → `ownerResourceName`/`ownerResourceId` conversion happens, instead of every create/
 * update call site repeating it. A `null`/`undefined` owner leaves the target untouched, keeping the
 * stored owner on update (an omitted pair means "don't change it", not "clear it").
 */
export function applyImageOwner<T extends Pick<ImageCreateUpdateAware, 'ownerResourceName' | 'ownerResourceId'>>(
  target: T,
  owner: ImageOwner | null | undefined
): T {
  if (owner) {
    target.ownerResourceName = owner.resourceName
    target.ownerResourceId = owner.resourceId
  }
  return target
}

export interface ImageStoreItem extends ImageCreateUpdateAwareKeyed {
  damAuthors: DocId[]
  showDamAuthors: boolean
  assetId: undefined | DocId
}
