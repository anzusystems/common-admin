# idnes_video: Idnes Video

## Supported codes

### URL

```
https://tv.idnes.cz/domaci/stanovisko-valorizace-duchodu-oznamit-desateho-brezna-oznamit-pavel.V230227_113206_idnestv_heli
```

### Embed

```html
<iframe width=630 height=403 src="//tv.idnes.cz/embed.aspx?idvideo=V230227_113206_idnestv_heli" frameborder=0 allowfullscreen></iframe>
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
  url: string
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
