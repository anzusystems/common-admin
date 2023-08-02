# embedPoll

## Features
- for now just select from existing polls

## Node schema

```json
{
  "name": "embedPoll",
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
  "type": "embedPoll",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindPoll {
  id: IntegerId
  article: IntegerId
  poll: IntegerId
  detail: todo
}
```
