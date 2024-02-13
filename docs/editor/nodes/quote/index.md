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
