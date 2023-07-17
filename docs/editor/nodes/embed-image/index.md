# EmbedImage

## Features
- User can select image from DAM using filterable dialog
- User can upload image from local file, so it will be uploaded to DAM and then used as embed
- User can drag and drop file directly to editor to upload to DAM and use as embed

## Node schema

```json
{
  "name": "embedImage",
  "groups": [
    "embed"
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
  "type": "embedImage",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindGallery {
  id: IntegerId
  article: IntegerId
  gallery: IntegerId
  link: string
  layout: 'parallax' | 'size20' | 'size50' | 'size100'
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
