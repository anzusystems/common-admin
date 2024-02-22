# Nodes

- if you think of the document as a tree, then nodes are just a type of content in that tree. Examples of nodes are paragraphs, headings, or code blocks. Nodes are mostly blocks, but nodes don’t have to be blocks. They can also be rendered inline with the text.

## Embeds
- all nodes starting with `embed` follow similar pattern (similar json structure in editor)
- example for `embedPoll` schema:

```json
{
  "name": "embedPoll",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": "" // string (uuid of embed)
    },
    "changeId": {
      "default": "" // string (uuid of last change made by user - needed for collaboration)
    }
  }
}
```
- example for `embedPoll` data json:

```json
{
  "type": "embedPoll",
  "attrs": {
    "id": "ae0a44d6-4c9b-40f8-b44f-30d978cd93fb",
    "changeId": "75f63c30-168f-11ee-b9a4-edda1c3364ed"
  }
}
```
- basically embeds are just placeholders where are they inserted in content
- all other data for embed is provided by embed API
- all embeds supports customData (todo: document it)

## Notes

- embedAudio, embedVideo are still WIP
