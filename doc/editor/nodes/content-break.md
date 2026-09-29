# contentBreak

## Features
- separates multiple parts of document
- no toolbar or slash-command item: the node comes from migrated content (legacy keybox `segment_description_break`), editors only keep, move or delete it

## Limitations
- only one per document

## Node schema

```json
{
  "name": "contentBreak",
  "groups": [
    "embed"
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
      "type": "contentBreak"
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
