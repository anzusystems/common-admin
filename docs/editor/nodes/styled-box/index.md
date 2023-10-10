# styledBox

// todo

## Features
- content of styledBoxContent:
  - heading
  - paragraph (text, embedImageInline)
  - hardBreak
  - orderedList
  - bulletList
  - embedImage
- marks of styledBoxContent:
  - all


## Node schema

```json
{
  "name": "styledBox",
  "content": "styledBoxTitle styledBoxContent",
  "group": "embed",
  "attrs": {
    "variant": {
      "default": "summary" // summary | column
    }
  }
}
```

## Node JSON example

```json
{
  "type": "styledBox",
  "attrs": {
    "variant": "summary"
  },
  "content": [
    {
      "type": "styledBoxTitle",
      "content": [
        {
          "type": "text",
          "text": "Lorem"
        }
      ]
    },
    {
      "type": "styledBoxContent",
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
              "text": "Lorem"
            }
          ]
        }
      ]
    }
  ]
}
```
