# spotify_episode: Spotify Episode (Anchor/Spotify for Podcasters )

Shared types (`Screenshot`, `Image`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://open.spotify.com/episode/7cSXcf4bJOalk8Hf9cwE57?si=c39c232d9a1049c1
```

### Embed

```html
<iframe style="border-radius:12px" src="https://open.spotify.com/embed/episode/7cSXcf4bJOalk8Hf9cwE57?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
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
