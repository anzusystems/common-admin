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

```ts twoslash
interface Params {
  id: string
  width?: number
  height?: number
}
```

## Data

```ts twoslash
import {DocId,DatetimeUTC} from "@anzusystems/common-admin"

/**
 * @property damId - DocId of the DAM asset.
 * @property type - Type of the screenshot.
 * @property width - Width of the screenshot.
 * @property height - Height of the screenshot.
 * @property contentType - Content type of the screenshot (e.g., image/jpeg).
 */
type Screenshot = {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string
}

type Author = {
  name: string
  image: Image
  url: string
}

/**
 * @property url - URL of the image variant.
 * @property damId - DocId of the DAM asset.
 * @property width - Width of the image variant.
 * @property height - Height of the image variant.
 * @property contentType - Content type of the image variant (e.g., image/jpeg).
 */
type Image = {
  variants: Array<{
    url: string
    damId: DocId
    width: number
    height: number
    contentType: string
  }>
}

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
  author: Author
  images: Image[]
}
```
