# embedPoll

## Features
- User can select from existing polls

## Node schema

```json
{
  "name": "embedPoll",
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
      "type": "embedPoll",
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
interface EmbedKindPoll {
  id: DocId
  poll: IntegerId
  detail: {
    poll: {
      id: IntegerId
      enabled: boolean
      texts: {
        title: string
        description: string
      }
      dates: {
        startOfVoting: DatetimeUTCNullable
        endOfVoting: DatetimeUTCNullable
      }
      attributes: {
        displayType: PollDisplayType
        hideVotes: boolean
      }
      options: Array<{
        id: IntegerId
        votes: number
        votesCached: number
        position: number
        title: string
      }>
      votes: number
      votesCached: number
    }
  }
}
```
