# button

- similar attrs to [link mark](/editor/marks/link/) (same attrs), with some changes, and it's block node.

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
  "type": "button",
  "content": [
    {
      "type": "text",
      "text": "bla bla bla"
    }
  ],
  "attrs": {
    "href": "https://www.sme.sk",
    "size": "large",
    "external": false,
    "nofollow": false,
    "variant": "link"
  }
} 
```
