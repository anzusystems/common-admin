# google_mymap: Google My Map

## Supported codes

### URL

```
https://www.google.com/maps/d/u/0/viewer?mid=1jQmjbJwq-jWYdJRQZm8P7omVqZIijUw&ll=49.24311676587614%2C20.625683100000032&z=11
```

### Embed

```html
<iframe src="https://www.google.com/maps/d/embed?mid=1jQmjbJwq-jWYdJRQZm8P7omVqZIijUw&ehbc=2E312F" width="640" height="480"></iframe> 
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
