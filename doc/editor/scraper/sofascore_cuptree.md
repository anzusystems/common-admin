# sofascore_cuptree: Sofascore Cup Tree

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Embed

```html
<iframe id="sofa-cupTree-embed-234-63409-10817984" src="https://widgets.sofascore.com/embed/unique-tournament/234/season/63409/cuptree/10817984?widgetTitle=24/25 NHL playoffs&showCompetitionLogo=true&widgetTheme=light" style=height:696px!important;max-width:700px!important;width:100%!important; frameborder="0" scrolling="yes"></iframe>
<iframe id="sofa-cupTree-embed-3-64007-10818303" src="https://widgets.sofascore.com/sk/embed/unique-tournament/3/season/64007/cuptree/10818303?widgetTitle=World Championship 2025, Knockout stage&showCompetitionLogo=true&widgetTheme=light" style=height:872px!important;max-width:700px!important;width:100%!important; frameborder="0" scrolling="yes"></iframe>
```

## Params

```ts
interface Params {
  id: string
  tournamentId: number
  seasonId: number
  cuptreeId: number
  slug: string
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
  title?: string
}
```
