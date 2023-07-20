# embedCustom

## Features
- same as other embeds that supports customForm, but with no dedicated fields

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
    "id": "sport;43264"
  }
}
```
