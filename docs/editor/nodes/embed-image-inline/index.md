# EmbedImageInline

## Features
todo

## Node schema

```json
{
  "name": "embedImageInline",
  "groups": [
    "embedImageInline"
  ],
  "attrs": {
    "id": {
      "default": null
    },
    "changeId": {
      "default": ""
    }
  }
}
```

## Node JSON example

```json
{
  "type": "embedImageInline",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindImage {
  id: IntegerId
  article: IntegerId
  image: IntegerId
  link: string
  align: 'right' | 'left' | 'center' | ''
  detail: {
    image: {
      id: IntegerId
      texts: {
        description: string
      }
      dam: {
        damId: DocId
        regionPosition: number
      }
      settings: {
        reviewed: boolean
      }
      imageAuthors: Array<{
        id: IntegerId
        position: number
        customAuthor: string
        image: IntegerId
        author: IntegerIdNullable
      }>
      position: number
    }
  }
}
```
