import type { DocId, IntegerId } from '@/types/common'

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
    // Request-only: licence the server takes the image over into when the asset is not usable directly.
    uploadLicenceId?: IntegerId
    // Request-only: take over an asset of another licence even when it could be used directly.
    forceTakeOver?: boolean
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
  // Request-only: the entity the image belongs to; an omitted pair keeps the stored owner.
  ownerResourceName?: string
  ownerResourceId?: IntegerId
}

export interface ImageCreateUpdateAwareKeyed extends ImageCreateUpdateAware {
  key: string
}

export function applyImageOwner<
  T extends Pick<ImageCreateUpdateAware, 'ownerResourceName' | 'ownerResourceId'>,
>(target: T, owner: ImageOwner | null | undefined): T {
  if (owner) {
    target.ownerResourceName = owner.resourceName
    target.ownerResourceId = owner.resourceId
  }
  return target
}

export interface ImageStoreItem extends ImageCreateUpdateAwareKeyed {
  damAuthors: DocId[]
  showDamAuthors: boolean
  damSources: DocId[]
  damSelectionChanged?: boolean
  assetId: undefined | DocId
}
