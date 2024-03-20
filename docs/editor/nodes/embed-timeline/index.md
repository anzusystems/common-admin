# embedTimeline

## Features
- user can insert timeline using filterable dialog

## Node schema

```json
{
  "name": "embedTimeline",
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
  "type": "doc",
  "content": [
    {
      "type": "embedTimeline",
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
interface EmbedTimelineAware {
  id: DocId
  timeline: IntegerId
  detail: {
    timeline: {
      id: IntegerId
      enabled: boolean
      texts: {
        title: string
        description: string
      }
      events: TimelineEvent[]
    }
  }
}

interface TimelineEvent extends SortableItemDataAware {
  id: IntegerId
  enabled: boolean
  texts: {
    title: string
    microdataTitle: string
    description: string
  }
  dates: {
    startDate: DatetimeUTCNullable
    endDate: DatetimeUTCNullable
  }
  url: string
  location: string
  position: number
}
```
