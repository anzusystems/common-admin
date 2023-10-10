# link

Based on [tiptap link](https://tiptap.dev/api/marks/link) with custom attrs.

## Features
- User can select part of text and add link mark
- If text is already linked user can modify or remove it
- When creating/updating link user can input following:
  - User can set hyperlink variant (`variant` enum attr): link, email, anchor
  - User can set that link is external (`external` boolean attr)
  - User can specify that link should add nofollow rel (`nofollow` boolean attr)
  - `href` can contain, examples:
    - `something@sme.sk` - email variant (without mailto)
    - `https://sme.sk` - link variant 
    - `pp-anchor` - anchor variant (prefixed by `pp-`, max 15 characters)


## Mark schema

```json
{
  "name": "link",
  "attrs": {
    "href": {
      "default": null
    },
    "external": {
      "default": false
    },
    "nofollow": {
      "default": false
    },
    "variant": {
      "default": "link" // link | email | anchor
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
        "variant": "link"
      }
    }

  ]
}
```
