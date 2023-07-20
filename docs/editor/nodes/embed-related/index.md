# embedRelated

## Features
- User can insert internal articles from CMS using filterable dialog to item, also can override article title
- User can insert external url for item and specify title fot his item
- user can mix both types
- User can override box title

## Node schema

```json
{
  "name": "embedRelated",
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
  "type": "embedRelated",
  "attrs": {
    "id": 23,
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
    url: string
    external: boolean
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
