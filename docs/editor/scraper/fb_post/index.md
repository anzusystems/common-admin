# fb_post: Facebook Post

## Supported codes

### URL

```
https://www.facebook.com/sme.sk/posts/pfbid0nHq4ynTLtKgghMAKzBmCpM3Zweqoycnnff8qw12e3RgRsstrXMg4dLKEBVwsGnQ2l 
```

### Embed

```html
<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fsme.sk%2Fposts%2Fpfbid0nHq4ynTLtKgghMAKzBmCpM3Zweqoycnnff8qw12e3RgRsstrXMg4dLKEBVwsGnQ2l&show_text=true&width=500" width="500" height="516" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe> 
```

## Params

```ts
interface Params {
  id: string
  username: string
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
  text: string
  author: Author
  publishedAt: DatetimeUTC
  images: Image[]
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}

interface Author {
  username: string
  name: string
  image: ImageVariant
  url: string
}

interface ImageVariant {
  url: string
  damId: DocId
  width: number
  height: number
  contentType: string  // e.g. image/jpeg
}

interface Image {
  variants: ImageVariant[]
}
```
