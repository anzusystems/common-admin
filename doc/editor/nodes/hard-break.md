# hardBreak

- see [tiptap docs](https://tiptap.dev/api/nodes/hard-break)

## Node schema

```json
{
  "name": "hardBreak",
  "groups": [
    "inline"
  ]
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "Lor"
        },
        {
          "type": "hardBreak"
        },
        {
          "type": "text",
          "text": "em"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Consectetur adipiscing elit,"
        },
        {
          "type": "hardBreak"
        },
        {
          "type": "text",
          "text": "sed do eiusmod tempor"
        },
        {
          "type": "hardBreak"
        },
        {
          "type": "text",
          "text": "incididunt ut labore et dolore magna aliqua"
        }
      ]
    }
  ]
}
```
