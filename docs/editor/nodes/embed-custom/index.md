# embedCustom

- todo: document customData
- used for special custom features
- same as other embeds that supports customData, but without its own fields
- field `name` is used to specify customData fields setup

## Features
- user can insert custom embed, choose name and fill form according its config

## Node schema

```json
{
  "name": "embedCustom",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": "" // string (uuid of embed)
    },
    "changeId": {
      "default": "" // string
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
      "type": "embedCustom",
      "attrs": {
        "id": "6dec11fb-34b2-42ec-8bc4-0bba216158a8",
        "changeId": "dc62ffef-ccb8-4ac4-8046-406d03c5ee5d"
      }
    }
  ]
}
```

## API data

```ts
interface EmbedCustomAware {
  id: DocId
  name: string
  customData: Record<string, any>
}
```

## Examples

### Onlajny.eu

```json
{
  "type": "embedCustom",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

```json
{
  "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
  "name": "todo",
  "customData": {
    "id": "43264"
  }
}
```
