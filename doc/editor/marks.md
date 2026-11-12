# Marks

One or multiple marks can be applied to nodes, for example to add inline formatting like bold and italic, or other additional information.

## Example

```jsonc
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
- shortcuts (tiptap defaults): bold `Mod+B`, italic `Mod+I`, underline `Mod+U`, strike `Mod+Shift+S`, subscript `Mod+,`, superscript `Mod+.`

## comment

- adds possibility to comment text
- it's just UX for editor, on render it should be skipped and ignored as it can contain internal information
- article body only; added from toolbar "more" → add comment

### Mark schema

```jsonc
{
  "name": "comment",
  "attrs": {
    "id": {
      "default": null // string | null (uuid of comment)
    }
  }
}
```

### Mark JSON example

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

## link

Based on [tiptap link](https://tiptap.dev/api/marks/link) with custom attrs.

### Features
- User can select part of text and add link mark
- If text is already linked user can modify or remove it
- `Ctrl+K` opens the link dialog
- typed URLs and emails are linked automatically; pasting a URL over selected text links it (`external` and `nofollow` false)
- for the anchor variant the dialog offers the anchors that exist in the document
- When creating/updating link user can input following:
  - User can set hyperlink variant (`variant` attr): link, email, anchor
  - User can set that link is external (`external` attr)
  - User can specify that link should add nofollow rel (`nofollow` attr)
  - `href` attr will contain value according to `variant`, examples:
    - `info@sme.sk` - a valid email address - email variant (without mailto)
    - `https://www.sme.sk` - a valid url - link variant
    - `pp-obsah` - slug (letters, digits and -) - anchor variant (prefixed by `pp-`, max 30 characters including prefix)

### Mark schema

```jsonc
{
  "name": "link",
  "attrs": {
    "href": {
      "default": null // string | null
    },
    "external": {
      "default": true // boolean
    },
    "internal": {
      "default": null // { type: string (route discriminator), id: string } | null
    },
    "nofollow": {
      "default": false // boolean
    },
    "variant": {
      "default": "link" // enum: link | email | anchor
    }
  }
}
```

### Mark JSON example

```jsonc
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "https://www.sme.sk",
        "external": true,
        "internal": null,
        "nofollow": true,
        "variant": "link"
      }
    }
  ]
}
```

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "info@sme.sk",
        "external": false,
        "internal": null,
        "nofollow": false,
        "variant": "email"
      }
    }
  ]
}
```

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "pp-obsah",
        "external": false,
        "internal": null,
        "nofollow": false,
        "variant": "anchor"
      }
    }
  ]
}
```

## articleLink

- no attrs; marks the words that core-cms turns into a link to the post's article (link mark, variant `link`, `external: false`)
- registered in minute post and post suggestion body editors; `Ctrl+Alt+K` or toolbar toggles it
- only one per document (toggling removes the previous one); the range is extended to whole words

### Mark JSON example

```json
{
  "type": "text",
  "text": "Lorem",
  "marks": [
    {
      "type": "articleLink"
    }
  ]
}
```
