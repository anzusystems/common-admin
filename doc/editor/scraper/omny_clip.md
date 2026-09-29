# omny_clip: Omny Clip

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

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

```ts
interface Params {
  id: string
  slug: string
  programSlug: string
  width?: number
  height?: number
}
```

## Data

```ts
type Author = {
  name?: string
}

type Program = {
  title?: string
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  title?: string
  program: Program
  description?: string
  author: Author
  publishedAt: DatetimeUTC // 0001-01-01T00:00:00Z when not scraped
}
```
