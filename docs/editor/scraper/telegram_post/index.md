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
  username: string
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
  name?: string
  url?: string
}

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  text?: string
  author: Author
  publishedAt: DatetimeUTC // 0001-01-01T00:00:00Z when not scraped
}
```
