# EmbedArticle

## Features
- User can select article from CMS using filterable dialog

## Limitations
- For now, user can't copy/paste and delete text including embed

## Node schema

```json
{
  "name": "embedArticle",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "hasDefault": true,
      "default": null
    },
    "changeId": {
      "hasDefault": true,
      "default": ""
    }
  },
  "inlineContent": false,
  "isBlock": true,
  "isText": false
}
```

## Node JSON example

```json
{
  "type": "embedArticle",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindImage {
  id: IntegerId
  article: IntegerId
  articleDocIDs: DocId[]
  detail: {
    articles: Array<{
      id: IntegerId
      articleDocId: DocId
      title: string
      leadImage: IntegerIdNullable
      listingImage: IntegerIdNullable
    }>
  }
}
```
