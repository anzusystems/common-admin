# vimeo_video: Vimeo Video

Shared types (`Screenshot`, `Image`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://vimeo.com/798891880
```

### Embed

```html
<iframe src="https://player.vimeo.com/video/798891880?h=1ddb1aa75b" width="640" height="320" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
<p><a href="https://vimeo.com/798891880">Another Young Couple</a> from <a href="https://vimeo.com/barryjenkins">Barry Jenkins</a> on <a href="https://vimeo.com">Vimeo</a>.</p>
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
type Author = {
  name?: string
  image: Image
  url?: string
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  title?: string
  text?: string
  author: Author
  publishedAt: DatetimeUTC // 0001-01-01T00:00:00Z when not scraped
  images?: Image[]
}
```
