# embedImage

- some attrs similar to [link mark](/editor/marks/link/)

## Features
- user can select image from DAM using filterable dialog
- user can upload image from local file, so it will be uploaded to DAM and then used as embed
- user can input `description` and `source` texts, they will be prefilled by upload if possible

## Node schema

```json
{
  "name": "embedImage",
  "groups": [
    "embedImage"
  ],
  "attrs": {
    "id": {
      "default": null // string | null (uuid of embed)
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
  image: IntegerIdNullable
  link: {
    href: string
    external: boolean
    nofollow: boolean
    variant: string // enum: link | email | anchor
    internal: { type: string, id: string } | null // see link mark
  }
  detail?: {
    image: {
      id: IntegerId
      texts: {
        description: string
        source: string
      }
      flags: {
        showSource: boolean
        internal: boolean
        overrideInternal: boolean
      }
      dam: {
        damId: DocId
        licenceId: IntegerId
        regionPosition: number
        animation: boolean
        internal: boolean
      }
    }
  }
  layout: string // enum: size100 | size20 | size120 | parallax | parallaxMobile
  align: string // enum: none | left | right
  zoomable: boolean
  displayMode: string // enum: crop3x2 | fullHeight
}
```
