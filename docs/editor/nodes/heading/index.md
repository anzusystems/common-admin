# heading

- See [tiptap docs](https://tiptap.dev/api/nodes/heading)
- textAlign attr is from [textAlign extension](/editor/extensions/text-align/) .
- anchor attr is from [anchor extension](/editor/extensions/anchor/).

## Limitations
- we allow only levels 2-5

## Node schema

```json
{
  "name": "heading",
  "groups": [
    "block"
  ],
  "attrs": {
    "textAlign": {
      "default": "left" // enum: left | right | center
    },
    "level": {
      "default": 2
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
      "type": "heading",
      "attrs": {
        "anchor": null,
        "textAlign": "left",
        "level": 2
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
