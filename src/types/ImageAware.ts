import type { DocId, DocIdNullable, IntegerId } from '@/types/common'

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
    takeOver?: boolean
    singleUse?: boolean
    originDamId?: DocIdNullable
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
}

export interface ImageCreateUpdateAwareKeyed extends ImageCreateUpdateAware {
  key: string
}

export interface ImageStoreItem extends ImageCreateUpdateAwareKeyed {
  damAuthors: DocId[]
  showDamAuthors: boolean
  assetId: undefined | DocId
}
