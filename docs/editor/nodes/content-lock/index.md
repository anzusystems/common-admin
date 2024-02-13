# contentLock

## Features
- User can add this separator to separate multiple 2 parts of document - free and paid part

## Requirements
- Only one per document

## Node schema

```json
{
  "name": "contentLock",
  "groups": [
    "lock"
  ]
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
          "text": "Lorem ipsum dolor sit amet."
        }
      ]
    },
    {
      "type": "contentLock"
    },
    {
      "type": "paragraph",
      "attrs": {
        "anchor": null,
        "textAlign": "left"
      },
      "content": [
        {
          "type": "text",
          "text": "Pulvinar mattis nunc sed blandit libero volutpat sed."
        }
      ]
    }
  ]
}
```
