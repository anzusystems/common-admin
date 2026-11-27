# podbean_episode: Podbean Episode

Shared types (`Screenshot`, `Image`, `DatetimeUTC`): see [README](README.md#shared-types).

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

```ts
interface Params {
  id: string
  height?: number
}
```

## Data

```ts
type Author = {
  name?: string
  image: Image
  url?: string
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  title?: string
  author: Author
  url?: string
}
```
