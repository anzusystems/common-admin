# orderedList

See [tiptap docs](https://tiptap.dev/api/nodes/ordered-list)
See [bulletList](/editor/nodes/bullet-list/)

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
  "type": "orderedList",
  "content": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Lorem"
            }
          ]
        }
      ]
    }
  ]
} 
```
