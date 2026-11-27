# button

- similar attrs to [link mark](../marks.md#link)

## Features
- user can insert specially styled button node
- this button can lead to email, link (url) or anchor (hash url)

## Node schema

```jsonc
{
  "name": "button",
  "groups": [
    "embed"
  ],
  "content": "inline*", // no marks
  "attrs": {
    "href": {
      "default": null // string | null
    },
    "external": {
      "default": true // boolean
    },
    "internal": {
      "default": null // { type: string, id: string } | null, see link mark
    },
    "nofollow": {
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

```jsonc
{
  "type": "doc",
  "content": [
    {
      "type": "button",
      "attrs": {
        "href": "https://www.sme.sk",
        "external": false,
        "internal": null,
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
