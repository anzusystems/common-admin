# embedGallery

## Features
- user can insert existing gallery from filterable dialog

## Node schema

```json
{
  "name": "embedGallery",
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
      "type": "embedGallery",
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
interface EmbedKindGallery {
  id: DocId
  gallery: IntegerId
  layout: string // enum: thumb | whole
  texts: {
    title: string
    description: string
  }
  detail: {
    gallery: {
      id: IntegerId
      enabled: boolean
      texts: {
        title: string
        description: string
      }
      url: string
      rubric: {
        attributes: {
          status: string // enum: show | hide
        }
        texts: {
          title: string
          shortTitle: string
          seoTitle: string
          description: string
          seoDescription: string
        }
        site: {
          name: string
          domain: string
        }
      }
      imagesCount: number
      images: Array<{
        position: number
        texts: {
          description: string
          source: string
        }
        dam: {
          damId: DocId
          regionPosition: number
          animation: boolean
          licenceId: number
        }
      }>
    }
  }
}
```
