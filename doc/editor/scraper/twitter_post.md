# twitter_post: Twitter Post

Shared types (`Screenshot`, `Image`, `Video`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Post URL

```
https://twitter.com/hsforeman/status/1618292100336070656
https://x.com/hsforeman/status/1618292100336070656
```

### Embed Post

```html
 <blockquote class="twitter-tweet"><p lang="en" dir="ltr">The <a href="https://twitter.com/washingtonpost?ref_src=twsrc%5Etfw">@washingtonpost</a> PR blog published a post about my new job as Accessibility Engineer. It includes more details on what we mean by accessibility and what kinds of work I’ll be doing in the new role. We also published a shorter version in plain language, which I’ll thread below. <a href="https://t.co/Aeg97ljv7U">https://t.co/Aeg97ljv7U</a></p>&mdash; Holden Saige Foreman (@hsforeman) <a href="https://twitter.com/hsforeman/status/1618292100336070656?ref_src=twsrc%5Etfw">January 25, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
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
