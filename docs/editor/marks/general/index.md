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
        "internal": null,
        "nofollow": false,
        "variant": "link"
      }
    }
  ]
}
```

## Built-in marks
- no attrs, JSON is just `{ "type": "<name>" }`
- `bold` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/bold)
- `italic` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/italic)
- `underline` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/underline)
- `strike` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/strike)
- `subscript` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/subscript)
- `superscript` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/marks/superscript)
