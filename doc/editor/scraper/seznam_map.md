# seznam_map: Seznam Mapy.cz

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://sk.frame.mapy.cz/s/jojulaloru
```

### Embed

```html
<iframe style="border:none" src="https://sk.frame.mapy.cz/s/dopejakagu" width="400" height="280" frameborder="0"></iframe>
<iframe style="border:none" src="https://mapy.com/s/dacozepeco" width="400" height="280" frameborder="0"></iframe>
```

## Params

```ts
interface Params {
  id: string
  width?: number
  height?: number
  locale?: string // scrape request locale, added on scrape
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url?: string
  description?: string
}
```
