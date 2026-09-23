# sportnet_video: Sportnet Video

## Supported codes

### URL

```
https://video.sportnet.online/embed/69010da0a722b12a4b3719d3
```

### Embed

```html
<iframe width="640" height="360" src="https://video.sportnet.online/embed/69010da0a722b12a4b3719d3"></iframe>
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
  description: string
}
```

