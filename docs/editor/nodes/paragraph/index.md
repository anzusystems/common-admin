# paragraph

- see [tiptap docs](https://tiptap.dev/api/nodes/paragraph)
- textAlign attr is from [textAlign extension](/editor/extensions/text-align/) .
- anchor attr is from [anchor extension](/editor/extensions/anchor/).

## Node schema

```json
{
  "name": "paragraph",
  "groups": [
    "block"
  ],
  "attrs": {
    "textAlign": {
      "default": "left" // enum: left | right | center
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
          "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        }
      ]
    }
  ]
}
```
