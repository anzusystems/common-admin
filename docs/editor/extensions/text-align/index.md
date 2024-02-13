# Text align extension

- see [tiptap docs](https://tiptap.dev/api/extensions/text-align).

## Features
- User can align text on configured nodes

## Limitations
- we allow only these alignments: `left`, `center`, `right`
- only allowed on these types: `heading`, `paragraph`

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "textAlign": "right",
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "Lorem ipsum dolor sit amet"
        }
      ]
    },
    {
      "type": "paragraph",
      "attrs": {
        "textAlign": "right"
      },
      "content": [
        {
          "type": "text",
          "text": "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
      ]
    }
  ]
}
```
