# slido_event: Slido Event

## Supported codes

### URL

```
https://app.sli.do/event/u4ZwGpY1DaXPFKVpjcqdgJ
```

### Embed

```html
<iframe src="https://app.sli.do/event/bbEehgh5a3LswDnFAJJiP3" height="100%" width="100%" frameBorder="0" style="min-height: 560px;" allow="clipboard-write" title="Slido"></iframe>
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
