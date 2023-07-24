# embedCustom

Same as other embeds that supports customData, but with no dedicated fields.
Field `name` is used to specify customData fields setup.

// todo add customData documentation

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
      "default": null
    },
    "changeId": {
      "default": ""
    }
  }
}
```

## Node JSON example

```json
{
  "type": "embedCustom",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindCustom {
  id: IntegerId
  article: IntegerId
  name: string
  customData: object
}
```

## Examples

### Onlajny.eu

```json
{
  "type": "embedCustom",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

```json
{
  "id": 23,
  "article": 60,
  "customData": {
    "id": "43264"
  }
}
```
