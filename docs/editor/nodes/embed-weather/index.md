# embedWeather

## Features
todo

## Node schema

```json
{
  "name": "embedWeather",
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
  "type": "embedWeather",
  "attrs": {
    "id": 23,
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
