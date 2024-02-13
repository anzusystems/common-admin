# embedImageInline

Similar to [embedImage](/editor/nodes/embed-image/), but it's inline node.

## Features
- User can insert file id from DAM

## Requirements
- DAM Image must have public original URL enabled.

## Node schema

```json
{
  "name": "embedImageInline",
  "groups": [
    "inline"
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
      "type": "paragraph",
      "attrs": {
        "anchor": null,
        "textAlign": "left"
      },
      "content": [
        {
          "type": "text",
          "text": "Lorem "
        },
        {
          "type": "embedImageInline",
          "attrs": {
            "id": "03f64301-e423-4f56-9d68-ddbe8108a571",
            "changeId": "37b51995-c284-4910-9580-b56d0533c19a"
          }
        },
        {
          "type": "text",
          "text": " ipsum"
        }
      ]
    }
  ]
}
```

## API data

```ts
interface EmbedImageInlineAware {
  id: DocId
  image: IntegerIdNullable
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
}
```
