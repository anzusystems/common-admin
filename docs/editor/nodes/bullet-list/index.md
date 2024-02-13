# bulletList

- see [tiptap docs](https://tiptap.dev/api/nodes/bullet-list)
- related to [orderedList](/editor/nodes/ordered-list/)

## Features
- user can toggle current node to bullet list, if possible (from paragraph or heading)

## Node schema

```json
{
  "name": "bulletList",
  "groups": [
    "block list"
  ]
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
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
                  "text": "rhoncus"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
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
                  "text": "neque"
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
