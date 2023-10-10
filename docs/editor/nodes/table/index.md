# table

See [tiptap docs](https://tiptap.dev/api/nodes/table)

// todo

## Node schema

```json
{
  "name": "table",
  "groups": [
    "block"
  ],
  "attrs": {
    "variant": {
      "default": ""  // sportnetTvProgram | default
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
      "type": "table",
      "attrs": {
        "variant": "",
        "caption": "Lorem"
      },
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
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
                  }
                }
              ]
            }
          ]
        }
      ]
    }
```
