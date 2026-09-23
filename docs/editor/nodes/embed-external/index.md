# embedExternal

- see [Scraper](/editor/scraper/general/) for info and all supported types

## Features
- user can open dialog, input supported code snippet inside textarea, and it will autodetect type of embed media and parse its content using scraper
- if the code is a youtube_video already distributed from DAM under the site group's video licences, embedVideo is inserted instead

## Node schema

```json
{
  "name": "embedExternal",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": null // string | null (uuid of embed)
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
  params: Record<string, string | number | boolean> // see Scraper docs
  data: Record<string, any> // see Scraper docs
  liveRenderEnabled: boolean
}
```

