# omny_clip: Omny Clip

## Supported codes

### URL

```
https://omny.fm/shows/gertie-s-law/the-story-behind-gerties-law
```

### Embed

```html
<iframe src="https://omny.fm/shows/gertie-s-law/the-story-behind-gerties-law/embed?style=Cover" width="100%" height="180" allow="autoplay; clipboard-write" frameborder="0" title="The Story Behind Gertie's Law"></iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
  slug: string
  programSlug: string
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

type Program = {
  title: string
}

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
  program: Program
  description: string
  author: Author
  publishedAt: DatetimeUTC
  images: Image[]
}
```
