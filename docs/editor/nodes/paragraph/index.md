# paragraph

See [tiptap docs](https://tiptap.dev/api/nodes/paragraph)
TextAlign attr is from [textAlign extension](/editor/extensions/text-align/) .

## Node schema

```json
{
  "name": "paragraph",
  "groups": [
    "block"
  ],
  "attrs": {
    "textAlign": {
      "default": "left" // left | right | center
    }
  }
}
```

## Node JSON example

```json
{
  "type": "paragraph",
  "attrs": {
    "textAlign": "left"
  },
  "content": [
    {
      "type": "text",
      "text": "bla bla bla"
    }
  ]
} 
```
