# embedWeather

## Features
- locationId input
- dialog - search for location

## Node schema

```json
{
  "name": "embedWeather",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": ""
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
  "type": "embedWeather",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindWeather {
  id: IntegerId
  article: IntegerId
  locationId: IntegerId
  variant: 'today'
  detail: todo
}
```
