# twitter_video: Twitter Video

Shared types (`Screenshot`, `Image`, `Video`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

Embed with `data-media-max-width` attribute (without it, the code is analyzed as [twitter_post](twitter_post.md)).

### Embed Post

```html
<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="en" dir="ltr">‘Skyscanner’ - new one from me &amp; <a href="https://twitter.com/BeyondChicago1?ref_src=twsrc%5Etfw">@BeyondChicago1</a> - OUT NOW<a href="https://t.co/J56RHJkryd">https://t.co/J56RHJkryd</a> <a href="https://t.co/KO9WG8CIlo">pic.twitter.com/KO9WG8CIlo</a></p>&mdash; example (@example) <a href="https://twitter.com/example/status/1819287109712146478?ref_src=twsrc%5Etfw">August 2, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
```

## Params

```ts
interface Params {
  id: string
  username: string
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
  images?: Image[]
  videos?: Video[]
}
```
