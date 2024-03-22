# pinterest_pin: Pinterest Pin

## Supported codes

### Short URL

```
https://pin.it/2hK5k3w 
```

### URl

```
https://www.pinterest.com/pin/651192427391236681/sent/?invite_code=807bdfd7341b40899585b2ad53f881f8&sfo=1
```

### Embed

```html
<iframe src="https://assets.pinterest.com/ext/embed.html?id=5629568271473963" height="988" width="600" frameborder="0" scrolling="no" ></iframe>
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
  title: string
  author: Author
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
  name: string
  image: Image
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
