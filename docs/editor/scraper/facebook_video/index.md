# facebook_video: Facebook Video

## Supported codes

### URL

```
https://www.facebook.com/JamesBond007AUS/videos/2427034044136560/ 
```

### Embed

```html
<iframe src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2Fkinolumiere%2Fvideos%2F677144637698465%2F&show_text=false&width=560&t=0" width="560" height="314" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>
```

### Short URL

```
https://fb.watch/iYK51sf0ZR/ 
```

## Params

```ts twoslash
/**
 * Time in seconds as integer.
 */
type Seconds = number

// ---cut-before---
interface Params {
  id: string
  username: string
  startTime?: Seconds
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
  url: string
  text: string
  author: Author
  images: Image[]
  videos: Video[]
}
```
