# google_map: Google Map

## Supported codes

### Embed

```html
<iframe src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10648.7596483298!2d17.108165795035593!3d48.14514381807679!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1ssk!2ssk!4v1677527483378!5m2!1ssk!2ssk" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe> 
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
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
