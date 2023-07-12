import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'

export interface ImageWidgetImage {
  id: IntegerId
  texts: {
    title?: string
    description: string
    author?: string
  }
  dam: {
    damId: DocId
    regionPosition: number
  }
  settings: {
    reviewed: false
  }
  position: number
  imageAuthors: ImageWidgetImageAuthor[]
  licences: ImageWidgetImageLicence[]
}

export interface ImageWidgetImageLicence {
  name: string // licencedBlog, licencedUser, etc.
  value: IntegerIdNullable
}

export interface ImageWidgetImageAuthor {
  id: IntegerId
  position: number
  customAuthor: string
  image: IntegerId
  author: IntegerIdNullable
}
