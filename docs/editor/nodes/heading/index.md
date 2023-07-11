# Heading

See [tiptap docs](https://tiptap.dev/api/nodes/heading)

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
