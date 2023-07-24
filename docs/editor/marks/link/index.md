# link

Based on [tiptap link](https://tiptap.dev/api/marks/link) with custom attrs.

todo: check if implement clickthrough and if yes how

## Features
- User can select part of text and add link mark
- If text is already linked user can modify or remove it
- When creating/updating link user can input following:
  - User can set that link is external (`external` boolean attr)
  - User can specify that link should add nofollow rel (`nofollow` boolean attr)
  - User can set that hyperlink is email (`email` boolean attr)


## Mark schema

```json
{
  "name": "link",
  "attrs": {
    "external": {
      "default": false
    },
    "nofollow": {
      "default": false
    },
    "email": {
      "default": false
    },
    "clickthrough": {
      "default": "" // check
    }
  }
}
```

## Mark JSON example

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "https://www.sme.sk",
        "external": false,
        "nofollow": false,
        "email": false,
        "clickthrough": "todo" // check
      }
    }

  ]
}
```
