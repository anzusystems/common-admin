# embedMinute

## Features
- user can insert minute topic using filterable dialog
- user can set title, date from and to, enable or disable auto refresh

## Node schema

```json
{
  "name": "embedMinute",
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
      "type": "embedMinute",
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
interface EmbedMinuteAware {
  id: DocId
  minuteTopic: IntegerId
  dateFrom: DatetimeUTC
  dateUntil: DatetimeUTC
  autoRefresh: boolean
  title: string
  detail: {
    minuteTopic: {
      id: IntegerId,
      title: string
      seoDescription: string
    }
  }
}
```
