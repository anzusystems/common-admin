# Marks

One or multiple marks can be applied to nodes, for example to add inline formatting like bold and italic, or other additional information.

## Example

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "bold"
    },
    {
      "type": "italic"
    },
    {
      "type": "link",
      "attrs": {
        "href": "https://www.sme.sk",
        "external": false,
        "nofollow": false,
        "variant": "link"
      }
    }
  ]
}
```
