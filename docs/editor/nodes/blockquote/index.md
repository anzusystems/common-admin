# blockquote

Based on [tiptap docs](https://tiptap.dev/api/nodes/blockquote) with custom attrs.

## Features
- User can set paragraph as blockquote
- User can specify author

## Node schema

```json
{
  "name": "blockquote",
  "groups": [
    "block"
  ],
  "attrs": {
    "author": {
      "default": ""
    }
  }
}
```

## Node JSON example

```json
{
  "type": "anchor",
  "attrs": {
    "author": "Lorem author"
  },
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Lorem content"
        }
      ]
    }
  ]
}
```
