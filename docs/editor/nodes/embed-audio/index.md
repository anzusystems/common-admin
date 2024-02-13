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
  "type": "doc",
  "content": [
    {
      "type": "embedAudio",
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
interface EmbedAudioAware {
  id: DocId
  asset: DocId
  licence: IntegerId
  image: DocId
  detail: {
    // wip
  }
}
```
