# telegram_post: Telegram Post

## Supported codes

### Post URL

```
  https://t.me/PellegriniOfficial/1352
```

### Embed Post

```html
 <script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-post="PellegriniOfficial/1352" data-width="100%"></script> 
```

## Params

```ts twoslash
interface Params {
  id: string
  username?: string
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
  text: string
  author: Author
  publishedAt: DatetimeUTC
  images: Image[]
}
```
