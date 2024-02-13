# embedCustom

- Same as other embeds that supports customData, but with no dedicated fields.
- Field `name` is used to specify customData fields setup.

## Features
- User can insert custom embed, choose name and input its fields.
- Used for special custom features.

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
