# quote

## Features
- user can set quote content directly in editor
- user can set quote author directly in editor

## Child nodes
- `quoteContent` - content `text*`, no marks
- `quoteAuthor` - content `text*`, no marks

## Node schema
```json
{
  "name": "quote",
  "content": "quoteContent quoteAuthor",
  "group": "embed"
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "quote",
      "content": [
        {
          "type": "quoteContent",
          "content": [
            {
              "type": "text",
              "text": "Lorem ipsum dolor sit amet"
            }
          ]
        },
        {
          "type": "quoteAuthor",
          "content": [
            {
              "type": "text",
              "text": "Lorem Ipsum"
            }
          ]
        }
      ]
    }
  ]
}
```
