# embedImage

- similar attrs to [link mark](/editor/marks/link/)

## Features
- User can select image from DAM using filterable dialog
- User can upload image from local file, so it will be uploaded to DAM and then used as embed
- User can drag and drop file directly to editor to upload to DAM and use as embed
- User can input `decription` and `source` texts

## Node schema

```json
{
  "name": "embedImage",
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
  "type": "doc",
  "content": [
    {
      "type": "embedImage",
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
interface EmbedImageAware {
  id: DocId
  image: IntegerId
  link: {
    href: string
    external: boolean
    nofollow: boolean
    variant: string // enum: link | email | anchor
  }
  detail?: {
    image: {
      id: IntegerId
      texts: {
        description: string
        source: string
      }
      dam: {
        damId: DocId
        licenceId: IntegerId
        regionPosition: number
        animation: boolean
      }
    }
  }
  layout: string // enum: size100 | size20 | size120 | parallax
  align: string // enum: none | left | right
}
```
