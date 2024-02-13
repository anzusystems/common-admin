# button

- similar attrs to [link mark](/editor/marks/link/)

## Features
- user can insert specially styled button node
- this button can lead to email, link (url) or anchor (hash url)

## Node schema

```json
{
  "name": "button",
  "groups": [
    "embed"
  ],
  "attrs": {
    "nofollow": {
      "default": false // boolean
    },
    "external": {
      "default": false // boolean
    },
    "variant": {
      "default": "link" // enum: link | email | anchor
    },
    "size": {
      "default": "small" // enum: large | small
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
      "type": "button",
      "attrs": {
        "href": "https://www.sme.sk",
        "external": false,
        "nofollow": false,
        "variant": "link",
        "size": "large"
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
```
