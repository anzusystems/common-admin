# table

- See [tiptap docs](https://tiptap.dev/api/nodes/table)

## Node schema

```json
{
  "name": "table",
  "groups": [
    "block"
  ],
  "attrs": {
    "variant": {
      "default": ""  // enum: sportnetTvProgram | default
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
