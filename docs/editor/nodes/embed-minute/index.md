# EmbedMinute

## Features
todo

## Node schema

```json
{
  "name": "embedMinute",
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
  "type": "embedMinute",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindMinute {
  id: IntegerId
  article: IntegerId
  source: IntegerId, // todo toto je zatial id minute temy, todo vyriesit ako vybrat articles  
  fromDate: DatetimeUTC,
  toDate: DatetimeUTC,
  autoRefresh: false,
  title: string
  detail: {
    todo
  }
}
```
