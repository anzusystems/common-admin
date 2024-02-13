# embedAudio

## Features
- User can insert audio from DAM using select dialog with filters.

## Node schema

```json
{
  "name": "embedAudio",
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
  "type": "embedAudio",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedAudioAware {
  asset: DocId
  licence: IntegerId
  image: DocId
  detail: {
    // wip
  }
}
```
