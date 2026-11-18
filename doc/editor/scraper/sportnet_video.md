# sportnet_video: Sportnet Video

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://video.sportnet.online/embed/69010da0a722b12a4b3719d3
```

### Embed

```html
<iframe width="640" height="360" src="https://video.sportnet.online/embed/69010da0a722b12a4b3719d3"></iframe>
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
  url?: string
  title?: string
  description?: string
}
```
