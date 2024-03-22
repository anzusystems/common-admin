# soundcloud_track - Soundcloud Track 

## Supported codes

### Embed

```html
<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1464676342&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"></iframe><div style="font-size: 10px; color: #cccccc;line-break: anywhere;word-break: normal;overflow: hidden;white-space: nowrap;text-overflow: ellipsis; font-family: Interstate,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Garuda,Verdana,Tahoma,sans-serif;font-weight: 100;"><a href="https://soundcloud.com/calvinharris" title="Calvin Harris" target="_blank" style="color: #cccccc; text-decoration: none;">Calvin Harris</a> · <a href="https://soundcloud.com/calvinharris/miracle-with-ellie-goulding" title="Miracle (with Ellie Goulding)" target="_blank" style="color: #cccccc; text-decoration: none;">Miracle (with Ellie Goulding)</a></div> 
```

## Params

```ts
interface Params {
  id: string
  height?: number
  color?: string // hexadecimal color code
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
  author: Author
  publishedAt: DatetimeUTC
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
  username: string
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
