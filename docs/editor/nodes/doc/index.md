# doc

- main container of whole document containing other nodes
- each system/entity can have its doc content and marks definition according to used nodes, marks, etc

## Node schema

```json
{
  "name": "doc",
  "content": "(block | lock | embed | embedImage)*" // system/entity specific
}
```
