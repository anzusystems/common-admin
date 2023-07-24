# heading

See [tiptap docs](https://tiptap.dev/api/nodes/heading)
TextAlign attr is from [textAlign extension](/editor/extensions/text-align/) .

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
      "default": "left" // left | right | center
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
  "type": "heading",
  "attrs": {
    "level": 2,
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
