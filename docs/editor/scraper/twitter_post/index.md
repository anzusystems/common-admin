# twitter_post: Twitter Post

## Supported codes

### Post URL

```
https://twitter.com/hsforeman/status/1618292100336070656 
```

### Embed Post

```html
 <blockquote class="twitter-tweet"><p lang="en" dir="ltr">The <a href="https://twitter.com/washingtonpost?ref_src=twsrc%5Etfw">@washingtonpost</a> PR blog published a post about my new job as Accessibility Engineer. It includes more details on what we mean by accessibility and what kinds of work I’ll be doing in the new role. We also published a shorter version in plain language, which I’ll thread below. <a href="https://t.co/Aeg97ljv7U">https://t.co/Aeg97ljv7U</a></p>&mdash; Holden Saige Foreman (@hsforeman) <a href="https://twitter.com/hsforeman/status/1618292100336070656?ref_src=twsrc%5Etfw">January 25, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 
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

/**
 * @property url - URL of the video variant.
 * @property bitrate - bitrate of the video variant.
 * @property contentType - Content type of the video variant (e.g., video/mp4).
 */
type Video = {
  variants: Array<{
    url: string
    bitrate: number
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
  videos: Video[]
}
```
