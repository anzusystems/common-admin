# horizontalRule

- See [tiptap docs](https://tiptap.dev/api/nodes/horizontal-rule)

## Node schema

```json
{
  "name": "horizontalRule",
  "groups": [
    "block"
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
          "text": "Lorem ipsum dolor sit amet"
        }
      ]
    },
    {
      "type": "horizontalRule"
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
          "text": "Lorem ipsum dolor sit amet"
        }
      ]
    }
  ]
}
```
