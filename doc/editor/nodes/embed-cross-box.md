# embedCrossBox

## Features
- user can select crossBox from filterable dialog.

## Node schema

```jsonc
{
  "name": "embedCrossBox",
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
      "type": "embedCrossBox",
      "attrs": {
        "id": "56f63eec-7f7d-49eb-b477-0f76a74d510f",
        "changeId": "143e0575-8898-4ad1-a9bb-4d1ea27efec7"
      }
    }
  ]
}
```

## API data

```ts
interface EmbedCrossBoxAware {
  id: DocId
  embeddedCrossBox: IntegerIdNullable
  detail?: {
    crossBox: {
      id: IntegerId
      enabled: boolean
      texts: {
        title: string
        description: string
        body: JSONContent
      }
      dates: {
        showAtFrom: DatetimeUTCNullable
        showAtUntil: DatetimeUTCNullable
      }
      flags: {
        allowAsEmbed: boolean
      }
    }
  }
}
```

## CrossBox body JSONContent
- doc starting with `doc`, content `(block | embed | embedImage)*`
- the cross box body editor allows `paragraph`, `heading` (2-5), `hardBreak`, `bulletList`, `orderedList`, `horizontalRule`, `table`, `button`, `contentBreak`, `embedImage`, `styledBox`, `quote` (+ `icon` for the editorIcons site group), marks `bold`, `italic`, `underline`, `strike`, `superscript`, `subscript`, `link`; no `anchor` attr
