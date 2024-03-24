# jw_video: JW Video

## Supported codes

### Embed

```html
<div style="position:relative; overflow:hidden; padding-bottom:56.25%"><iframe src="https://cdn.jwplayer.com/players/7jlkRVJY-59OQ4sBA.html" width="100%" height="100%" frameborder="0" scrolling="auto" title="Krajčovič: Maslo z Nemecka je lacnejšie ako zo Slovenska. Naši potravinári nie sú konkurencieschopní" style="position:absolute;" allowfullscreen></iframe></div> 
```

## Params

```ts
interface Params {
  id: string
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  title: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
