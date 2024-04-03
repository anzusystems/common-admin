# facebook_post: Facebook Post

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

```ts twoslash
interface Params {
  id: string
  username: string
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
  username: string
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
  text: string
  author: Author
  publishedAt: DatetimeUTC
  images: Image[]
}
```
