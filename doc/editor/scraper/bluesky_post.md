# bluesky_post: Bluesky Post

Shared types (`Screenshot`, `Image`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://bsky.app/profile/denniksme.bsky.social/post/3ltlpyyjwar2q
```

### Embed

```html
<blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:d5vgdl6bjkaoy35sujppkr3i/app.bsky.feed.post/3ltlpyyjwar2q" data-bluesky-cid="bafyreifxcl2zuu63r55bsyu46spq346y2l6nl5763fa4gfq3zwmok4ca2m" data-bluesky-embed-color-mode="system"><p lang="">Košický kraj má ďalší problém. Polícia zasahovala pre podvod za milióny na východe aj vo Zvolene<br><br><a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i/post/3ltlpyyjwar2q?ref_src=embed">[image or embed]</a></p>&mdash; SME.sk (<a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i?ref_src=embed">@denniksme.bsky.social</a>) <a href="https://bsky.app/profile/did:plc:d5vgdl6bjkaoy35sujppkr3i/post/3ltlpyyjwar2q?ref_src=embed">July 10, 2025 at 8:42 AM</a></blockquote><script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
```

## Params

```ts
interface Params {
  id: string
  did: string
}
```

## Data

```ts
type Author = {
  username?: string
  name?: string
  image: Image
  url?: string
}

interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  text?: string
  author: Author
  publishedAt: DatetimeUTC // 0001-01-01T00:00:00Z when not scraped
}
```
