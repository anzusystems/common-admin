# Anchor extension

- adds global attribute `anchor` for anchor target

## Node JSON examples

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

## Notes
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
