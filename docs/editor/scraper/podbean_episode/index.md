# podbean_episode: Podbean Episode

## Supported codes

### URL

```
https://www.podbean.com/ew/pb-v47zv-1316d23
```

### Embed

```html
<iframe title="EP 038: THE MONARCH OF MONTGOMERY STREET" allowtransparency="true" height="300" width="100%" style="border: none; min-width: min(100%, 430px);" scrolling="no" data-name="pb-iframe-player" src="https://www.podbean.com/player-v2/?from=embed&i=v47zv-1316d23-pb&square=1&share=1&download=1&fonts=Arial&skin=1&font-color=auto&rtl=0&logo_link=episode_page&btn-skin=2baf9e&size=300" allowfullscreen=""></iframe>
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

type Author = {
  name: string
  image: Image
  url: string
}

/**
 * @property url - URL of the image variant.
 * @property damId - DocId of the DAM asset.
 * @property width - Width of the image variant.
 * @property height - Height of the image variant.
 * @property contentType - Content type of the image variant (e.g., image/jpeg).
 */
type Image = {
  variants: Array<{
    url: string
    damId: DocId
    width: number
    height: number
    contentType: string
  }>
}

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  title: string
  author: Author
  url: string
}
```
