# Nodes

- if you think of the document as a tree, then nodes are just a type of content in that tree. Examples of nodes are paragraphs, headings, or code blocks. Nodes are mostly blocks, but nodes don’t have to be blocks. They can also be rendered inline with the text.

## Embeds
- all nodes starting with `embed` follow similar pattern (similar json structure in editor)
- example for `embedPoll` schema:

```jsonc
{
  "name": "embedPoll",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": null // string | null (uuid of embed)
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
- all embeds support optional `customData`: `{ [key: string]: boolean | string | number | string[] | number[] }`, fields are defined by custom form config for the embed kind
- every embed in API data also has `discriminator` (node name without `embed`: `poll`, `external`, `imageInline`, …) and one owner field named after the entity (`article`, `articleTemplateBody`, `crossBox`, `contentItemKindWysiwyg`, `contentItemKindPageHeader`, `liveBlogFeedExtendedDescription`, …) holding its id
- a new embed node gets one fresh uuid as both `id` and `changeId` and its dialog opens; closing the dialog before the embed is saved deletes the node; every save sets a new `changeId`

## Editors
- each admin-cms editor registers its own set of nodes (see [doc](doc.md) for top level content); below: article body, article template body, live blog feed extended description, cross box body, content item kind wysiwyg and page header, layout template help
- everywhere: paragraph, text, hardBreak, heading, bulletList, orderedList, horizontalRule, table, styledBox; marks bold, italic, underline, strike, superscript, subscript, link
- all except live blog feed extended description: button, contentBreak, quote
- article body and article template body only: contentLock, embedCustom, embedFaq, embedPoll, embedQuiz, embedReview, embedTimeline, embedWeather; mark comment is article body only
- embedCrossBox: article body, article template body, live blog feed extended description
- embedGallery, embedRelated: article body, article template body, live blog feed extended description, content item kind wysiwyg
- embedImage: all except layout template help (content item kind page header*)
- embedExternal, embedAudio: article body, article template body, live blog feed extended description, content item kind wysiwyg, content item kind page header*
- embedVideo: article body, article template body, live blog feed extended description, content item kind page header*
- embedExternalImage: article body, article template body, content item kind wysiwyg, content item kind page header*
- embedImageInline, embedExternalImageInline: article body, article template body, content item kind page header*
- \* only when the page header editor has embeds enabled (`embedEntities`)
- toolbar and slash-command items appear only for nodes registered in the editor; contentBreak, embedExternalImage and embedExternalImageInline have none

## All nodes

- [bulletList](bullet-list.md)
- [button](button.md)
- [contentBreak](content-break.md)
- [contentLock](content-lock.md)
- [doc](doc.md)
- [embedAudio](embed-audio.md)
- [embedCrossBox](embed-cross-box.md)
- [embedCustom](embed-custom.md)
- [embedExternal](embed-external.md)
- [embedExternalImage](embed-external-image.md)
- [embedExternalImageInline](embed-external-image-inline.md)
- [embedFaq](embed-faq.md)
- [embedGallery](embed-gallery.md)
- [embedImage](embed-image.md)
- [embedImageInline](embed-image-inline.md)
- [embedPoll](embed-poll.md)
- [embedQuiz](embed-quiz.md)
- [embedRelated](embed-related.md)
- [embedReview](embed-review.md)
- [embedTimeline](embed-timeline.md)
- [embedVideo](embed-video.md)
- [embedWeather](embed-weather.md)
- [hardBreak](hard-break.md)
- [heading](heading.md)
- [horizontalRule](horizontal-rule.md)
- [orderedList](ordered-list.md)
- [paragraph](paragraph.md)
- [quote](quote.md)
- [styledBox](styled-box.md)
- [table](table.md)
- [text](text.md)
- not documented yet: embedDangerBox, embedElection, embedLiveBlog, icon, inlinePlaceholder, blockPlaceholder
