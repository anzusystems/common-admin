# youtube_video: Youtube video

Shared types (`Screenshot`, `Image`, `Seconds`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://www.youtube.com/watch?v=fJZnasCyBvY
https://www.youtube.com/live/8GGvlMYK13U
```

### Short URL

```
https://youtu.be/fJZnasCyBvY
```

### Embed

```html
<iframe width="560" height="315" src="https://www.youtube.com/embed/fJZnasCyBvY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<iframe width="560" height="315" src="https://www.youtube.com/embed/nWm_OhIKms8?si=yDado8u66AHiuwM7&amp;start=604" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
```

## Params

```ts
interface Params {
  id: string
  startTime?: Seconds
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
  shortDescription?: string
  duration?: number // seconds
  uploadedAt?: DatetimeUTC
  embedUrl?: string
  author: Author
  images?: Image[]
}
```
