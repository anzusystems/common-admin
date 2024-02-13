# contentBreak

## Features
- user can add this separator to separate multiple parts of document

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
