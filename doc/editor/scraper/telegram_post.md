# telegram_post: Telegram Post

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Post URL

```
  https://t.me/PellegriniOfficial/1352
```

### Embed Post

```html
 <script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-post="PellegriniOfficial/1352" data-width="100%"></script>
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
  name?: string
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
