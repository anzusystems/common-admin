# embedGallery

## Features
- User can insert existing gallery or choose from existing galleries.
- User can create a new gallery and upload images to this gallery (it will be uploaded to DAM also) and user can also choose from existing DAM images and add them to gallery.

## Node schema

```json
{
  "name": "embedGallery",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": ""
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
  "type": "embedGallery",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
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
  layoutType: 'thumb' | 'whole'
  title: string
  detail: todo
}
```
