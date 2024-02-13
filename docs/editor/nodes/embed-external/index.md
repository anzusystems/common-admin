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
  "type": "embedExternal",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedExternalAware {
  id: DocId
  variant: string // enum, see Scraper docs
  scrapeStatus: string // enum: error | done | pending | unassigned
  params: Record<string, any> // see Scraper docs
  data: Record<string, any> // see Scraper docs
}
```

