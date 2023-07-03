# EmbedImage

## Features
- User can select image from DAM using filterable dialog
- WIP: User can upload image from local file, so it will be uploaded to DAM and then used as embed
- WIP: User can drag and drop file directly to editor to upload to DAM and use as embed

## Limitations
- For now, user can't copy/paste and delete text including embed

## Node schema

```json
{
  "name": "embedImage",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "hasDefault": true,
      "default": null
    },
    "changeId": {
      "hasDefault": true,
      "default": ""
    }
  },
  "inlineContent": false,
  "isBlock": true,
  "isText": false
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
interface EmbedKindImage {
  id: IntegerId
  article: IntegerId
  image: IntegerId
  link: string
  detail: {
    image: {
      id: IntegerId
      texts: {
        title: string
        description: string
      }
      dam: {
        damId: DocId
        regionPosition: number
      }
      settings: {
        reviewed: boolean
      }
      imageAuthors: ImageAuthor[]
      position: number
    }
  }
}
```
