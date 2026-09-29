# sofascore_totw: Sofascore Team of the Week

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Embed

```html
<iframe id="sofa-totw-embed-17-61627-18400" width="100%" height="598" style="display:block;max-width:700px" src="https://widgets.sofascore.com/embed/unique-tournament/17/season/61627/round/18400/teamOfTheWeek?showCompetitionLogo=true&widgetTheme=light&widgetTitle=Premier%20League" frameBorder="0" scrolling="no"></iframe>
<iframe id="sofa-totw-embed-7-61644-17442" width="100%" height="598" style="display:block;max-width:700px" src="https://widgets.sofascore.com/de-DE/embed/unique-tournament/7/season/61644/round/17442/teamOfTheWeek?showCompetitionLogo=true&widgetTheme=light&widgetTitle=UEFA%20Champions%20League" frameBorder="0" scrolling="no"></iframe>
```

## Params

```ts
interface Params {
  id: string
  tournamentId: number
  seasonId: number
  roundId: number
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
