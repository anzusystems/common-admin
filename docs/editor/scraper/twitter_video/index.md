# twitter_video: Twitter Video

## Supported codes

### Embed Post

```html
<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="en" dir="ltr">‘Skyscanner’ - new one from me &amp; <a href="https://twitter.com/BeyondChicago1?ref_src=twsrc%5Etfw">@BeyondChicago1</a> - OUT NOW<a href="https://t.co/J56RHJkryd">https://t.co/J56RHJkryd</a> <a href="https://t.co/KO9WG8CIlo">pic.twitter.com/KO9WG8CIlo</a></p>&mdash; example (@example) <a href="https://twitter.com/example/status/1819287109712146478?ref_src=twsrc%5Etfw">August 2, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 
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
