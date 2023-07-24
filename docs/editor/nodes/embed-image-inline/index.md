# embedImageInline

Similar to [embedImage](/editor/nodes/embed-image/), possibility to define dimensions, with more placement possibilities.

// todo setup groups

## Features
- User can select image from DAM using filterable dialog
- User can upload image from local file, so it will be uploaded to DAM and then used as embed
- User can drag and drop file directly to editor to upload to DAM and use as embed
- User can input `decription` and `source` texts

## Node schema

```json
{
  "name": "embedImageInline",
  "groups": [
    "inline"
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
  width: string // px
  height: string // px
  detail: {
    image: {
      id: IntegerId
      texts: {
        description: string
        source: string
      }
      dam: {
        damId: DocId
        regionPosition: number
      }
      settings: {
        reviewed: boolean
      }
      position: number
    }
  }
}
```
