# slido_poll: Slido Poll

## Supported codes

### URL

```
https://app.sli.do/event/fh8EBR1TV8HdHxDpahHs1W/embed/polls/5abc998f-6811-4d99-820b-39dab88b45b5
```

### Embed

```html
<iframe src="https://app.sli.do/event/fh8EBR1TV8HdHxDpahHs1W/embed/polls/5abc998f-6811-4d99-820b-39dab88b45b5" width="300" height="400"></iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
  subId: string
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
