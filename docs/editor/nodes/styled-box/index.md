# styledBox

## Features
- User can insert styledBox to document
- User can set styledBox title directly in editor
- User can set styledBox content directly in editor
- content of styledBoxContent:
  - paragraph (text, embedImageInline)
  - hardBreak
  - orderedList
  - bulletList
- marks of styledBoxContent:
  - all


## Child nodes
- `styledBoxTitle` - content `text*`, no marks; with `allowIcons` option `(text | icon)*` (article body: only for site group from `editorIcons.siteGroup` env config)
- `styledBoxContent` - content `(paragraph | list)+`

## Node schema

```json
{
  "name": "styledBox",
  "content": "styledBoxTitle styledBoxContent",
  "group": "embed",
  "attrs": {
    "variant": {
      "default": "summary" // enum: summary | column
    }
  }
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
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
              "text": "Lorem ipsum dolor sit amet"
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
                  "text": "Lorem ipsum dolor sit amet"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
