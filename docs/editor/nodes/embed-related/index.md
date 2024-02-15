# embedRelated

## Features
- user can insert internal articles from CMS using filterable dialog to item
- user can insert external url for item and specify title fot his item
- user can override title

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
      "default": "" // string (uuid of embed)
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
  items: RelatedItemKindArticle[] | RelatedItemKindLink[]
  detail: {
    items: Array<RelatedItemDetailKindArticle | RelatedItemDetailKindLink>
  }
}

interface RelatedItemKindArticle {
  title: string
  articleDocId: DocId
  position: number
  discriminator: 'article'
}

interface RelatedItemKindLink {
  title: string
  src: string
  position: number
  external: boolean
  nofollow: boolean
  discriminator: 'link'
}

interface RelatedItemDetailKindArticle {
  id: DocId
  position: number
  title: string
  article: {
    id: IntegerId
    docId: DocId
    url: string
    status: string // enum: draft | ready | published
    dates: {
      publishedAt: DatetimeUTCNullable
      firstPublishedAt: DatetimeUTCNullable
      expireAt: DatetimeUTCNullable
      publicPublishedAt: DatetimeUTC
      publicUpdatedAt: DatetimeUTCNullable
    }
    texts: {
      title: string
      leadText: string
    }
    listingImage: IntegerIdNullable
  }
  discriminator: 'article'
}

interface RelatedItemDetailKindLink {
  id: DocId
  position: number
  title: string
  src: string
  external: boolean
  nofollow: boolean
  discriminator: 'link'
}
```
