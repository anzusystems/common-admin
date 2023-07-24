# review

// todo needs more product specs

## Features
- User can insert node by selecting review entity or providing its id

## Notes
- After inserting the node, there needs to be a callback to set review array to article 

## Node schema

```json
{
  "name": "review",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": null
    }
  }
}
```

## Node JSON example

```json
{
  "type": "review",
  "attrs": {
    "id": 23
  }
}
```
