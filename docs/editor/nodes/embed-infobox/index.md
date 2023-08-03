# embedInfobox

// todo specify fields: only body for now

Infobox is special entity with tiptap json body with specific schema.

## Features
- User can select infobox from list of existing.
- User can create a new infobox or edit existing in new dialog
- nodes:
  - heading h2-h5
  - paragraph
  - text
  - hardBreak
  - orderedList
  - bulletList
  - embedImage
  - embedImageInline
  - embedGallery
  - faq
- marks:
  - all

## Node schema

```json
{
  "name": "embedInfobox",
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
  "type": "embedInfobox",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindInfobox {
  id: IntegerId
  article: IntegerId
  infobox: IntegerId
  detail: todo
}
```
