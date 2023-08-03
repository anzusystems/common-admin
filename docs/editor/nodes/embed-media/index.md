# embedMedia

See [Media](/editor/media/general/) for general info and all supported options.

## Features
- User can open dialog, input supported code snippet inside textarea, and it will autodetect type of embed media and parse its content
- User can input the media type and its fields manually.
- // todo

## Node schema

```json
{
  "name": "embedMedia",
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
  "type": "embedMedia",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindMedia {
  id: IntegerId
  article: IntegerId
  variant: string // see Media docs
  damId: DocIdNullable
  damType: 'audio' | 'video'
  align: 'left' | 'right' | 'center',
  ratio: number,
  dataHeight: number
  data: object // see Media docs
}
```

