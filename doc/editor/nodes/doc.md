# doc

- main container of whole document containing other nodes
- each system/entity can have its doc content and marks definition according to used nodes, marks, etc
- content per admin-cms editor:
  - `(block | lock | embed | embedImage)*` - article body, article template body
  - `(block | embed | embedImage)*` - live blog feed extended description, cross box body, content item kind wysiwyg, content item kind page header with embeds
  - `(block)*` - content item kind page header without embeds
  - `(block | embed)*` - layout template help
  - `block*` - FAQ item answer

## Node schema

```jsonc
{
  "name": "doc",
  "content": "(block | lock | embed | embedImage)*" // system/entity specific
}
```
