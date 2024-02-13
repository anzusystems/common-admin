# bulletList

- see [tiptap docs](https://tiptap.dev/api/nodes/bullet-list)
- related to [orderedList](/editor/nodes/ordered-list/)

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
  "type": "bulletList",
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
