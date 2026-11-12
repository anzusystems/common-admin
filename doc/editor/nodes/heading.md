# heading

- see [tiptap docs](https://tiptap.dev/api/nodes/heading)
- textAlign attr is from [textAlign extension](../extensions.md#text-align-extension) .
- anchor attr is from [anchor extension](../extensions.md#anchor-extension) (not registered in cross box, content item kind page header and layout template help).

## Features
- `Ctrl+Alt+M` toggles level 2; tiptap's `Mod-Alt-<level>` shortcuts are replaced and don't work
- slash command `/` turns the line into level 2

## Limitations
- levels 2-5; only 2 in live blog feed extended description, 2-3 in content item kind wysiwyg
- layout template help and content item kind page header have no heading buttons in the toolbar

## Node schema

```jsonc
{
  "name": "heading",
  "groups": [
    "block"
  ],
  "attrs": {
    "textAlign": {
      "default": "left" // enum: left | right | center; null in cross box, content item kind and layout template help editors
    },
    "level": {
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
      "type": "heading",
      "attrs": {
        "anchor": null,
        "textAlign": "left",
        "level": 2
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
```
