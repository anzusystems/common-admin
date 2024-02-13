# embedExternalImage
- inline node, so it can be inside of paragraph or heading nodes

## Features
- only for migration or used as readonly in anzutap
- should be replaced by `embedImage` after media migration

## Requirements
- skip on render

## Node schema

```json
{
  "name": "embedExternalImageInline",
  "groups": [
    "embed"
  ],
  "inline": true,
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
          "type": "embedExternalImageInline",
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
