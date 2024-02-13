# embedReview

## Features
- User can select from existing reviews

## Node schema

```json
{
  "name": "embedReview",
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
      "type": "embedReview",
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
interface EmbedReviewAware {
  id: DocId
  review: IntegerId
  detail: {
    review: {
      id: IntegerId
      title: string
      type: string // enum: product | book | movie | game
      enabled: boolean
      affiliate: boolean
      rating: number
      description: string
      pros: ListItemDto[]
      cons: ListItemDto[]
      price: string
      info: string
      links: LinkDto[]
    }
  }
}

interface ListItemDto {
  title: string
  position: number
}

interface LinkDto {
  title: string
  url: string
  position: number
}
```
