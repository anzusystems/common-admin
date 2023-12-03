import type { DocId, IntegerId } from '@/types/common'

export interface ImageAware {
  id: IntegerId
  texts: {
    description: string
    source: string
  }
  dam: {
    damId: DocId
    regionPosition: number
  }
  position: number
  // licences: ImageWidgetImageLicence[]
}

export interface ImageCreateUpdateAware extends Omit<ImageAware, 'id'> {
  id?: IntegerId
}

export interface ImageCreateUpdateAwareKeyed extends ImageCreateUpdateAware {
  key: string
}

// export interface ImageWidgetImageLicence {
//   name: string // licencedBlog, licencedUser, etc.
//   value: IntegerIdNullable
// }
