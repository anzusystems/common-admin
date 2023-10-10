# button

Similar attrs to [link mark](/editor/marks/link/), with some changes, and it's block node.

## Node schema

```json
{
  "name": "button",
  "groups": [
    "embed"
  ],
  "attrs": {
    "nofollow": {
      "default": false
    },
    "external": {
      "default": false
    },
    "variant": {
      "default": "link" // link | email | anchor
    },
    "size": {
      "default": "small" // large | small
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
