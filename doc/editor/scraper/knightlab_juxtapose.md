# knightlab_juxtapose: Knightlab Juxtapose

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://cdn.knightlab.com/libs/juxtapose/latest/embed/index.html?uid=6c05899e-9ada-11ef-9397-d93975fe8866
```

### Embed

```html
<iframe frameborder="0" class="juxtapose" width="100%" height="360" src="https://cdn.knightlab.com/libs/juxtapose/latest/embed/index.html?uid=6c05899e-9ada-11ef-9397-d93975fe8866"></iframe>
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
```
