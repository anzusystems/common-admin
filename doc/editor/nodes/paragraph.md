# paragraph

- see [tiptap docs](https://tiptap.dev/api/nodes/paragraph)
- textAlign attr is from [textAlign extension](../extensions.md#text-align-extension) .
- anchor attr is from [anchor extension](../extensions.md#anchor-extension) (not registered in cross box, content item kind page header and layout template help).

## Node schema

```jsonc
{
  "name": "paragraph",
  "groups": [
    "block"
  ],
  "attrs": {
    "textAlign": {
      "default": "left" // enum: left | right | center; null in cross box, content item kind and layout template help editors
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
