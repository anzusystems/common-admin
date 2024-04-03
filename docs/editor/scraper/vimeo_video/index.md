# vimeo_video: Vimeo Video

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
  text: string
  author: Author
  publishedAt: DatetimeUTC
  images: Image[]
}
```
