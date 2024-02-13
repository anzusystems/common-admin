# text

- See [tiptap docs](https://tiptap.dev/api/nodes/text)

## Node schema

```json
{
  "name": "text",
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
