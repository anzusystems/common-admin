# tiktok_video: TikTok Video

## Supported codes

### URL

```
https://www.tiktok.com/@mandyj513/video/7179241045773815046?is_from_webapp=1&sender_device=pc 
```

### Embed

```html
<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@mandyj513/video/7179241045773815046" data-video-id="7179241045773815046" style="max-width: 605px;min-width: 325px;" > <section> <a target="_blank" title="@mandyj513" href="https://www.tiktok.com/@mandyj513?refer=embed">@mandyj513</a> Snow Removal Tool <a title="foryou" target="_blank" href="https://www.tiktok.com/tag/foryou?refer=embed">#foryou</a> <a title="goodthing" target="_blank" href="https://www.tiktok.com/tag/goodthing?refer=embed">#goodthing</a> <a title="tiktokshopping" target="_blank" href="https://www.tiktok.com/tag/tiktokshopping?refer=embed">#tiktokshopping</a> <a title="carsnowremoval" target="_blank" href="https://www.tiktok.com/tag/carsnowremoval?refer=embed">#carsnowremoval</a> <a title="snowremover" target="_blank" href="https://www.tiktok.com/tag/snowremover?refer=embed">#snowremover</a> <a target="_blank" title="♬ Sunrise - Official Sound Studio" href="https://www.tiktok.com/music/Sunrise-6618871733141113604?refer=embed">♬ Sunrise - Official Sound Studio</a> </section> </blockquote> <script async src="https://www.tiktok.com/embed.js"></script>
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
  images: Image[]
}
```
