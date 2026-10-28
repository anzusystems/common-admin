# embedFaq

## Features
- user can insert existing FAQ using filterable dialog

## Node schema

```jsonc
{
  "name": "embedFaq",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": null // string | null (uuid of embed)
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
  faq: IntegerIdNullable
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
- doc starting with `doc`, content `block*`
- the answer editor allows only `paragraph`, `hardBreak`, `bulletList`, `orderedList`, `horizontalRule` and marks `bold`, `italic`, `underline`, `strike`, `superscript`, `subscript`, `link` (no `textAlign`, no `anchor`)
