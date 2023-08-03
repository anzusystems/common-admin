# embedRelated

## Features
- User can insert internal articles from CMS using filterable dialog to item
- User can insert external url for item and specify title fot his item
- User can mix both types
- User can override title

NTH: copy/paste url of article -> embedRelated

## Node schema

```json
{
  "name": "embedRelated",
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
  "type": "embedRelated",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindRelated {
  id: IntegerId
  title: string
  items: Array<{
    source: DocId | string
    title: string
    type: 'article' | 'link'
    external: boolean
    nofollow: boolean
  }>
  article: IntegerId
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
