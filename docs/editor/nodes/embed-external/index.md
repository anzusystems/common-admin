# embedExternal

- See [Scraper](/editor/scraper/general/) for info and all supported types.

## Features
- User can open dialog, input supported code snippet inside textarea, and it will autodetect type of embed media and parse its content using scraper
- if the media embed code is from DAM and according to some licence restrictions, convert it to embedAudio or embedVideo 

## Node schema

```json
{
  "name": "embedExternal",
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
      "type": "embedExternal",
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
interface EmbedExternalAware {
  id: DocId
  type: string // enum, see Scraper docs
  scrapeStatus: string // enum: error | done | pending | unassigned
  params: Record<string, any> // see Scraper docs
  data: Record<string, any> // see Scraper docs
}
```

