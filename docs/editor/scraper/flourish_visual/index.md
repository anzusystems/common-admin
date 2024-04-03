# flourish_visual: Flourish Visualisation

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
  subtitle: string
}
```
