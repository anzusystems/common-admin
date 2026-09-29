# soundcloud_track: Soundcloud Track

Shared types (`Screenshot`, `Image`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Embed

```html
<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1464676342&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"></iframe><div style="font-size: 10px; color: #cccccc;line-break: anywhere;word-break: normal;overflow: hidden;white-space: nowrap;text-overflow: ellipsis; font-family: Interstate,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Garuda,Verdana,Tahoma,sans-serif;font-weight: 100;"><a href="https://soundcloud.com/calvinharris" title="Calvin Harris" target="_blank" style="color: #cccccc; text-decoration: none;">Calvin Harris</a> · <a href="https://soundcloud.com/calvinharris/miracle-with-ellie-goulding" title="Miracle (with Ellie Goulding)" target="_blank" style="color: #cccccc; text-decoration: none;">Miracle (with Ellie Goulding)</a></div>
<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A1512758497&color=%23b6b6b6&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"></iframe>
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
type Author = {
  name?: string
  username?: string
  url?: string
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  title?: string
  author: Author
  publishedAt: DatetimeUTC // 0001-01-01T00:00:00Z when not scraped
  images?: Image[]
}
```
