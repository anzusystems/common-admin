# bluesky_post: Bluesky Post

## Supported codes

### URL

```
https://bsky.app/profile/denniksme.bsky.social/post/3ltlpyyjwar2q
```

### Embed

```html
<blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:d5vgdl6bjkaoy35sujppkr3i/app.bsky.feed.post/3ltlpyyjwar2q" data-bluesky-cid="bafyreifxcl2zuu63r55bsyu46spq346y2l6nl5763fa4gfq3zwmok4ca2m" data-bluesky-embed-color-mode="system"><p lang="">Košický kraj má ďalší problém. Polícia zasahovala pre podvod za milióny na východe aj vo Zvolene<br><br><a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i/post/3ltlpyyjwar2q?ref_src=embed">[image or embed]</a></p>&mdash; SME.sk (<a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i?ref_src=embed">@denniksme.bsky.social</a>) <a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i/post/3ltlpyyjwar2q?ref_src=embed">July 10, 2025 at 8:42 AM</a></blockquote><script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
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
  id: number
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  text: string
  author: Author
  publishedAt: DatetimeUTC
}
```
