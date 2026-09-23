# embedRelated

## Features
- user can insert internal articles from CMS using filterable dialog to item
- user can insert external url for item and specify headline for this item
- user can override headline

## Note
- model supports mixing both types but for now only one item can be inserted at once

## Node schema

```json
{
  "name": "embedRelated",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": null // string | null (uuid of embed)
    },
    "changeId": {
      "default": "" // string
    }
  }
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "embedRelated",
      "attrs": {
        "id": "6dec11fb-34b2-42ec-8bc4-0bba216158a8",
        "changeId": "dc62ffef-ccb8-4ac4-8046-406d03c5ee5d"
      }
    }
  ]
}
```

## API data

```ts
interface EmbedRelatedAware {
  id: DocId
  title: string
  items: Array<RelatedItemKindArticle | RelatedItemKindLink>
  detail?: {
    items: Array<RelatedItemDetailKindArticle | RelatedItemDetailKindLink>
  }
}

interface RelatedItemKindArticle {
  id?: DocId
  overline: string
  headline: string
  perex: string
  articleDocId: DocId
  position: number
  discriminator: 'article'
}

interface RelatedItemKindLink {
  id?: DocId
  overline: string
  headline: string
  perex: string
  url: string
  position: number
  external: boolean
  nofollow: boolean
  image: IntegerIdNullable
  publishedAt: DatetimeUTC
  discriminator: 'link'
}

interface RelatedItemDetailKindArticle {
  id: DocId
  position: number
  overline: string
  headline: string
  perex: string
  article: {
    id: IntegerId
    docId: DocId
    url: string
    status: string // enum: draft | ready | publishing | published
    dates: {
      publishedAt: DatetimeUTCNullable
      firstPublishedAt: DatetimeUTCNullable
      expireAt: DatetimeUTCNullable
      publicPublishedAt: DatetimeUTC
      publicUpdatedAt: DatetimeUTCNullable
    }
    texts: {
      overline: string
      headline: string
      perex: string
    }
    image: ImageAware | IntegerIdNullable
  }
  discriminator: 'article'
}

interface RelatedItemDetailKindLink {
  id: DocId
  position: number
  overline: string
  headline: string
  perex: string
  url: string
  external: boolean
  nofollow: boolean
  image?: ImageAware | null
  discriminator: 'link'
}
```
