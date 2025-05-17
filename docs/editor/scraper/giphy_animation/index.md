# giphy_animation: Giphy Animation

## Supported codes

### URL

```
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2M5bm9xbjZ6cXJneWF2c2Rkb2V4a2tneDIzcTFobjFjYzd5dHptNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iibH5ymW6LFvSIVyUc/giphy.gif
```

### Embed

```html
<iframe src="https://giphy.com/embed/iibH5ymW6LFvSIVyUc" width="462" height="480" style="" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="https://giphy.com/gifs/wednesday-wed-happy-iibH5ymW6LFvSIVyUc">via GIPHY</a></p>
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
