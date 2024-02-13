# link

Based on [tiptap link](https://tiptap.dev/api/marks/link) with custom attrs.

## Features
- User can select part of text and add link mark
- If text is already linked user can modify or remove it
- When creating/updating link user can input following:
  - User can set hyperlink variant (`variant` attr): link, email, anchor
  - User can set that link is external (`external` attr)
  - User can specify that link should add nofollow rel (`nofollow` attr)
  - `href` attr will contain value according to `variant`, examples:
    - `info@sme.sk` - a valid email address - email variant (without mailto)
    - `https://www.sme.sk` - a valid url - link variant 
    - `pp-obsah` - slug (a-z charactars and -) - anchor variant (prefixed by `pp-`, max 15 characters, prefix can be customized)


## Mark schema

```json
{
  "name": "link",
  "attrs": {
    "href": {
      "default": null // string | null
    },
    "external": {
      "default": false // boolean
    },
    "nofollow": {
      "default": false // boolean
    },
    "variant": {
      "default": "link" // enum: link | email | anchor
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
        "external": true,
        "nofollow": true,
        "variant": "link"
      }
    }
  ]
}
```

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "email",
      "attrs": {
        "href": "info@sme.sk",
        "external": false,
        "nofollow": false,
        "variant": "email"
      }
    }
  ]
}
```

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "email",
      "attrs": {
        "href": "pp-obsah",
        "external": false,
        "nofollow": false,
        "variant": "anchor"
      }
    }
  ]
}
```
