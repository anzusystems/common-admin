# quote

## Features
- User can set quote content
- User can set quote author

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
  "type": "quote",
  "content": [
    {
      "type": "quoteContent",
      "content": [
        {
          "type": "text",
          "text": "Lorem"
        }
      ]
    },
    {
      "type": "quoteAuthor",
      "content": [
        {
          "type": "text",
          "text": "Lorem"
        }
      ]
    }
  ]
}
```
