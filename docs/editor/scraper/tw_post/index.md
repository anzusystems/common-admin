# tw_post: Twitter Post

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

```ts
interface Params {
  id: string
  username?: string
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[];
  scrapedAt: DatetimeUTC
  text: string;
  author: Author;
  publishedAt: DatetimeUTC
  images: Image[];
  videos: Video[];
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}

interface Author {
  username: string
  name: string
  image: ImageVariant
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

interface VideoVariant {
  url: string
  bitrate: number
  contentType: string  // e.g. video/mp4
}

interface Video {
  variants: VideoVariant[]
}
```
