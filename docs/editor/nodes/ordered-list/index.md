# orderedList

- see [tiptap docs](https://tiptap.dev/api/nodes/ordered-list)
- related to [bulletList](/editor/nodes/bullet-list/)

## Features
- user can toggle current node to ordered list, if possible (from paragraph or heading)


## Node schema

```json
{
  "name": "orderedList",
  "groups": [
    "block list"
  ],
  "attrs": {
    "start": {
      "default": 1
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
      "type": "orderedList",
      "attrs": {
        "start": 1
      },
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
                  "text": "vestibulum"
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
                  "text": "pellentesque"
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
