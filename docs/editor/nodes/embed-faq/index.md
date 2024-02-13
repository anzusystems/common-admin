# embedFaq

## Features
- user can insert existing FAQ using filterable dialog

## Node schema

```json
{
  "name": "embedFaq",
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
      "type": "embedFaq",
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
interface EmbedFaqAware {
  id: DocId
  faq: IntegerId
  detail?: {
    faq: {
      texts: FaqTexts
      enabled: boolean
      items: Array<{
        id: IntegerId
        enabled: boolean
        position: number
        question: string
        answer: JSONContent
      }>
    }
  }
}
```

## FAQ item answer JSONContent
- theoretically can contain doc with all nodes from these docs, of course starting with `doc`
