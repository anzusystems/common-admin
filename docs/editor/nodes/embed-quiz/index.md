# embedQuiz

## Features
- todo

## Node schema

```json
{
  "name": "embedQuiz",
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
  "type": "embedQuiz",
  "attrs": {
    "id": 23,
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```

## API data

```ts
interface EmbedKindQuiz {
  id: IntegerId
  article: IntegerId
  quiz: IntegerId
  detail: todo
}
```
