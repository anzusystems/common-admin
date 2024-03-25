# spotify_episode: Spotify Episode (Anchor/Spotify for Podcasters )

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
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  title: string
  author: Author
  url: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}

interface Author {
  url: string
  name: string
  image: Image
}

interface ImageVariant {
  damId: DocId
  url: string
  width: number
  height: number
  contentType: string  // e.g. image/jpeg
}

interface Image {
  variants: ImageVariant[]
}
```
