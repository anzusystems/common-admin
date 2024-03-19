# flourish_visual - Flourish Visualisation

## Supported codes

### URL

```
https://public.flourish.studio/visualisation/8830543/ 
```

### Embed

```html
<div class="flourish-embed flourish-chart" data-src="visualisation/8830543"><script src="https://public.flourish.studio/resources/embed.js"></script></div> 
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
  subtitle: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
