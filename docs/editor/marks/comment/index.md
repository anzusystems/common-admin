# comment

- adds possibility to comment text
- it's just UX for editor, on render it should be skipped and ignored as it can contain internal information

## Mark schema

```json
{
  "name": "bold",
  "attrs": {
    "id": {
      "default": "" // string (uuid of comment)
    }
  }
}
```

## Mark JSON example

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "comment",
      "attrs": {
        "id": "f519f25a-7dda-46f7-8f64-074abdb95552"
      }
    }
  ]
}
```
