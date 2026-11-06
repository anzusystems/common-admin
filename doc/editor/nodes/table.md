# table

- see [tiptap docs](https://tiptap.dev/api/nodes/table)

## Features
- toolbar inserts a 3×3 table with a header row
- bubble menu: add column before/after, add row before/after, delete row/column, delete table; edit button opens the table dialog (`caption`, `variant`)
- merging/splitting cells and toggling header row/column are not offered
- columns are resizable (`colwidth` filled) only in cross box, content item kind and layout template help editors

## Child nodes
- `tableRow` - content `(tableCell | tableHeader)*`, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-row)
- `tableHeader` - attrs `colspan` (1), `rowspan` (1), `colwidth` (null), content `block+`, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-header)
- `tableCell` - same attrs as `tableHeader`, content `paragraph+` in article body, article template body and live blog feed extended description, `block+` elsewhere, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/nodes/table-cell)

## Node schema

```jsonc
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
