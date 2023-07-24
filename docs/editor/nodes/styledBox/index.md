# styledBox

## Features

todo features and schema also it's not final, its node that can contain content

## Node schema

```json
{
  "name": "styledBox",
  "groups": [
    "embed"
  ],
  "attrs": {
    "variant": {
      "default": "summary" // summary | column
    },
    "title": {
      "default": ""
    }
  }
}
```

## Node JSON example

```json
{
  "type": "styledBox",
  "attrs": {
    "variant": "summary",
    "title": "blabla"
  },
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "bla bla bla"
        }
      ]
    }
  ]
}
```
