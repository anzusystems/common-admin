import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'

export interface Image {
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
  imageAuthors: ImageAuthor[]
  licences: ImageLicence[]
}

export interface ImageLicence {
  name: string // licencedBlog, licencedUser, etc.
  value: IntegerIdNullable
}

export interface ImageAuthor {
  id: IntegerId
  position: number
  customAuthor: string
  image: IntegerId
  author: IntegerIdNullable
}
