# facebook_reel: Facebook Reel

Shared types (`Screenshot`, `Image`, `Seconds`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://www.facebook.com/reel/986566783263294
```

### Embed

```html
<iframe src="https://www.facebook.com/plugins/video.php?height=476&href=https%3A%2f%2fwww.facebook.com%2freel%2f986566783263294%2f&show_text=false&width=267&t=0" width="267" height="476" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>
```

## Params

```ts
interface Params {
  id: string
  startTime?: Seconds
  showText?: boolean
  width?: number
  height?: number
}
```

## Data

```ts
type Author = {
  name?: string
  image: Image
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  author: Author
  images?: Image[]
}
```
