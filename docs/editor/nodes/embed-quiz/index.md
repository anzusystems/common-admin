# embedQuiz

## Features
- user can insert quiz using filterable dialog

## Node schema

```json
{
  "name": "embedQuiz",
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
      "type": "embedQuiz",
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
interface EmbedQuizAware {
  id: DocId
  quiz: IntegerId
  detail: {
    quiz: {
      id: IntegerId
      enabled: boolean
      title: string
      attributes: QuizAttributes
      questions: Array<{
        id: IntegerId
        position: number
        title: string
        explanation: string
        image: IntegerIdNullable
        explanationImage: IntegerIdNullable
        answers: Array<{
          id: IntegerId
          position: number
          question: IntegerId
          title: string
          image: IntegerIdNullable
          points: number
        }>
      }>
      results: Array<{
        id: IntegerId
        position: number
        title: string
        pointsFrom: number
        pointsUntil: number
      }>
    }
  }
}
```
