# iframe_basic: Iframe Basic

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

Any iframe embed whose `src` matches the allow-list regexp (env `IFRAME_BASIC_ALLOW_LIST_REGEXP`).

### Embed

```html
<iframe width="600" height="400" src="https://example.com" frameborder="0" allowfullscreen></iframe>
```

## Params

```ts
interface Params {
  id: string // full iframe src URL
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string // same as params.id
}
```
