# Extensions

Most extensions are UX helpers to show some information to user or enable special way to input data.
Only these extensions modify the content:
- [anchor](#anchor-extension)
- [textAlign](#text-align-extension)
- [tocGenerate](#toc-generate-extension)
- [grammarSuggestion](#grammar-suggestion-extension) (accepted suggestions rewrite text)
- [paste extensions](#paste-extensions) (`pasteEmbeds`, `pasteExternalEmbedSnippet`, `pasteDamAsset`, `pasteArticleLinkEmbed`)
- `trailingNode` - keeps an empty paragraph at the end of the document (article body, article template body); the article body drops it when the body is stored, the article template body keeps it

## Built-in extensions
- `CharacterCount` - character count of raw text, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/character-count)
- `Dropcursor` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/dropcursor)
- `Gapcursor` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/gapcursor)
- `ListKeymap` - see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/listkeymap)
- `Placeholder` - placeholder texts for empty paragraph, quote content/author and styledBox title (article body, article template body, live blog feed extended description), see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/placeholder)
- `Collaboration` - article body only, when collaboration is enabled, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)
- `CollaborationCaret` - article body only, when collaboration is enabled, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration-caret)
- `UndoRedo` - in article body only when collaboration is disabled, because collaboration has its own history; other editors register it always, see [tiptap docs](https://tiptap.dev/docs/editor/extensions/functionality/undo-redo)

## Anchor extension

- adds global attribute `anchor` for anchor target
- registered for `paragraph` and `heading` in article body, article template body, live blog feed extended description and content item kind wysiwyg
- value is `pp-` + slug (the anchor dialog adds the prefix); duplicate and empty anchors are reset to `null` automatically
- the editor shows a warning icon on anchors nothing links to, and on anchor links / buttons without a target

### Node JSON examples

```json
{
  "type": "paragraph",
  "attrs": {
    "anchor": "pp-lorem-ipsum"
  },
  "content": [
    {
      "type": "text",
      "text": "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }
  ]
}
```

```json
{
  "type": "heading",
  "attrs": {
    "anchor": "pp-dolor-sit-am",
    "level": 2
  },
  "content": [
    {
      "type": "text",
      "text": "Dolor sit amet"
    }
  ]
}
```

### Notes
- the html transform can be for example:
```html
<p id="pp-lorem-ipsum">
  Consectetur adipiscing elit,
  sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
</p>
```

```html
<h2 id="pp-dolor-sit-am">Dolor sit amet</h2>
```
- so `<a href="#pp-lorem-ipsum">Link</a>` and `<a href="#pp-dolor-sit-am">Link 2</a>` can be used

## Anzutap config

- common configuration required for some embeds / nodes
- `registryKey` option is required, editor throws on create without it
- other options: `locale` (content language, default `en`, used e.g. as the scrape locale), `collabEnabled`, `disableIndividualEmbedFetch` (`true` or phases `['init']` / `['change']`: embed nodes skip fetching their own data in that phase; every editor except article body uses `['init']`)

## Grammar suggestion extension

- extension name `grammarSuggestion`, article body only
- runs AI proofreading and shows suggestions as inline highlights to accept or reject
- a check needs proofreading permissions, a site with proofreading configured, a saved article, being the moderator of the article's collaboration room and no other collaborator in the article

## Linter extension

- extension name `linterDemo`, registered in article body and article template body editors
- Highlight words that match list of unwanted words
- the word list is hardcoded in the extension, `badWords` option is ignored
- the list contains only `najoptimálnejší`

## Paste extensions

- `pasteEmbeds` - on paste, top level embeds get a new id and are cloned via API, see Limitations in [README](README.md)
- `pasteExternalEmbedSnippet` - embed code or supported URL → embedExternal, see [Scraper](scraper/README.md)
- `pasteDamAsset` - DAM admin asset URL → [embedImage](nodes/embed-image.md) / [embedVideo](nodes/embed-video.md), article body and article template body only
- `pasteArticleLinkEmbed` - single URL → [embedRelated](nodes/embed-related.md) with the matching CMS article, otherwise plain text
- on a collapsed selection `pasteExternalEmbedSnippet`, `pasteDamAsset` and `pasteArticleLinkEmbed` are tried in this order, before the link mark's paste handling
- not registered in the article newsletter copy of the body editor

## Slash commands extension

- When user types `/` at start of a line or after a space, dialog for most common inserts will appear
- registered in article body (not in the newsletter copy), article template body and live blog feed extended description
- items, each shown only if its node is registered: paragraph, heading (level 2), embedImage, styledBox, icon, blockPlaceholder; text typed after `/` filters them by title prefix, diacritics ignored

## Table caption extension

- shows the table caption above every table (placeholder when empty); clicking it opens the table dialog
- registered in article body, article template body and live blog feed extended description

## Text align extension

- see [tiptap docs](https://tiptap.dev/api/extensions/text-align).

### Features
- User can align text on configured nodes
- the toolbar has buttons only for `left` and `right`; `center` is valid in content but can't be set from the UI

### Limitations
- we allow only these alignments: `left`, `center`, `right`
- only allowed on these types: `heading`, `paragraph`
- default is the editor's `defaultAlignment`: `left` in article body, article template body and live blog feed extended description, `null` where not set (cross box, content item kind, layout template help)

### Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "textAlign": "right",
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "Lorem ipsum dolor sit amet"
        }
      ]
    },
    {
      "type": "paragraph",
      "attrs": {
        "textAlign": "right"
      },
      "content": [
        {
          "type": "text",
          "text": "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
      ]
    }
  ]
}
```

## Toc generate extension

- Collects all level 2 headings in document and generates `styledBox` node with bullet list and links to anchor, also adds anchors on level 2 headings if missing
- toolbar "more" → generate TOC, article body and article template body only
- the box replaces the current selection, its title is the content-locale translation of `plugin.toc.title`
- with no level 2 heading it shows a warning and inserts nothing
- generated anchors are cut to 15 characters including `pp-`
