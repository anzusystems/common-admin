# jw_video: JW Video

## Supported codes

### Embed

```html
<div style="position:relative; overflow:hidden; padding-bottom:56.25%"><iframe src="https://cdn.jwplayer.com/players/7jlkRVJY-59OQ4sBA.html" width="100%" height="100%" frameborder="0" scrolling="auto" title="Krajčovič: Maslo z Nemecka je lacnejšie ako zo Slovenska. Naši potravinári nie sú konkurencieschopní" style="position:absolute;" allowfullscreen></iframe></div> 
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
  title: string
}
```
