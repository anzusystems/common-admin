# table

- see [tiptap docs](https://tiptap.dev/api/nodes/table)

## Child nodes
- `tableRow` - content `(tableCell | tableHeader)*`, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-row)
- `tableHeader` - attrs `colspan` (1), `rowspan` (1), `colwidth` (null), content `block+`, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-header)
- `tableCell` - same attrs as `tableHeader`, content `paragraph+`, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-cell)

## Node schema

```json
{
  "name": "table",
  "groups": [
    "block"
  ],
  "attrs": {
    "variant": {
      "default": "default" // enum: default | sportnetTvProgram
    },
    "caption": {
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
      "type": "table",
      "attrs": {
        "variant": "default",
        "caption": ""
      },
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableHeader",
              "attrs": {
                "colspan": 1,
                "rowspan": 1,
                "colwidth": null
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "anchor": null,
                    "textAlign": "left"
                  },
                  "content": [
                    {
                      "type": "text",
                      "text": "Lorem ipsum dolor sit amet"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
