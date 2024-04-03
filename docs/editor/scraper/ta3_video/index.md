# ta3_video: TA3 Video

## Supported codes

### URL

```
https://www.ta3.com/embed/20191010-hw-bae91537-77da-44e5-96dc-08ac3b0a6b90 
```

### Embed

```html
<iframe src='https://www.ta3.com/embed/20240227-hw-249f3b65-dd91-4031-9c76-edb8bc35f80d' width='750' height='422' frameborder='0' scrolling='no'></iframe>
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
}
```
