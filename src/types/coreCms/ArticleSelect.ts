import type { DocId, IntegerId } from '@/types/common'
import type { ArticleKind } from '@/types/coreCms/ArticleKind'

export enum ArticleSelectReturnType {
  DocId = 'docId',
  Id = 'id',
  Article = 'article',
}

export type ArticleSelectReturnTypeValues =`${ArticleSelectReturnType}`

export type ArticleSelectReturnData =  ArticleSelectReturnDocId | ArticleSelectReturnId | ArticleSelectReturnArticle

interface ArticleSelectReturnDocId {
  type: 'docId'
  value: Array<DocId>
}

interface ArticleSelectReturnId {
  type: 'id'
  value: Array<IntegerId>
}

interface ArticleSelectReturnArticle {
  type: 'article'
  value: Array<ArticleKind>
}

export const articleSelectReturnTypeValuesToEnum = (value: ArticleSelectReturnTypeValues) => {
  switch (value) {
    case 'id':
      return ArticleSelectReturnType.Id
    case 'article':
      return ArticleSelectReturnType.Article
    case 'docId':
    default:
      return ArticleSelectReturnType.DocId
  }
}
