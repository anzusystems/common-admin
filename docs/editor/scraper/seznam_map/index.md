# seznam_map: Seznam Mapy.cz

## Supported codes

### URL

```
https://sk.frame.mapy.cz/s/jojulaloru
```

### Embed

```html
<iframe style="border:none" src="https://sk.frame.mapy.cz/s/dopejakagu" width="400" height="280" frameborder="0"></iframe>
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
}
```
