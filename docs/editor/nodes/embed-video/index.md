# EmbedVideo

## Features
todo

## Node schema

```json
{
  "name": "embedVideo",
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
  "type": "EmbedWeather",
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
  srcId: string,
  subType: 'youtube', // todo check types
  ratio: number, // todo check types
  dataHeight: number // todo check types
  detail: {
    todo
  }
}
```

