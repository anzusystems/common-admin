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

```ts twoslash
interface Params {
  id: string
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

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
}
```
