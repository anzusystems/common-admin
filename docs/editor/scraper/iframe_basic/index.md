# iframe_basic: Iframe Basic

## Supported codes

Any whitelisted iframe embed.

### Embed

```html
<iframe width="600" height="400" src="https://example.com" frameborder="0" allowfullscreen></iframe>
```

## Params

```ts
interface Params {
  id: string
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
