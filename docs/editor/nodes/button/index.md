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
    "email": {
      "default": false
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
    "size": "large | small",
    "external": false,
    "nofollow": false,
    "email": false
  }
} 
```
