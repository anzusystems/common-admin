# anchor

- todo change to mark

## Features
- User can place inline anchor anywhere in text and specify name
- Name is auto converted to safe slug

## Node schema

```json
{
  "name": "anchor",
  "groups": [
    "anchor" // todo
  ],
  "attrs": {
    "name": {
      "default": ""
    }
  }
}
```

## Node JSON example

```json
{
  "type": "anchor",
  "attrs": {
    "name": "zaver" // slug
  }
}
```
