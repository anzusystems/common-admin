# sofascore_standing: Sofascore League standings

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### Embed

```html
<iframe id="sofa-standings-embed-1-61627" src="https://widgets.sofascore.com/embed/tournament/1/season/61627/standings/Premier%20League?widgetTitle=Premier%20League&showCompetitionLogo=true" style=height:1123px!important;max-width:768px!important;width:100%!important; frameborder="0" scrolling="no"></iframe>
<iframe id="sofa-standings-embed-1981-64007" src="https://widgets.sofascore.com/sk/embed/tournament/1981/season/64007/standings/World%20Championship%202025%2C%20Group%20A?widgetTitle=World%20Championship%202025%2C%20Group%20A&showCompetitionLogo=true" style=height:591px!important;max-width:768px!important;width:100%!important; frameborder="0" scrolling="no"></iframe>
```

## Params

```ts
interface Params {
  id: string
  tournamentId: number
  seasonId: number
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
  standings?: Standing[]
}

interface Team {
  name: string
  shortName: string
}

interface Standing {
  team: Team
  position: number
  wins: number
  draws: number
  losses: number
  points: number
  matches: number
  scoresFor: number
  scoresAgainst: number
  overtimeLosses: number
}
```
