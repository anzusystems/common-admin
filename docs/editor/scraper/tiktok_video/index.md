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

```ts
interface Params {
  id: string
  username: string
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  text: string
  author: Author
  images: Image[]
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}

interface Author {
  name: string
  image: Image
  url: string
}

interface ImageVariant {
  damId: DocId
  url: string
  width: number
  height: number
  contentType: string  // e.g. image/jpeg
}

interface Image {
  variants: ImageVariant[]
}
```
