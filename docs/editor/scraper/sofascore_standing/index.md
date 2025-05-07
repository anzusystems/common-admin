# sofascore_standing: Sofascore League standings

## Supported codes

### Embed

```html
<iframe id="sofa-standings-embed-1-61627" src="https://widgets.sofascore.com/embed/tournament/1/season/61627/standings/Premier%20League?widgetTitle=Premier%20League&showCompetitionLogo=true" style=height:1123px!important;max-width:768px!important;width:100%!important; frameborder="0" scrolling="no"></iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
  tournamentId: number
  seasonId: number
  slug: string
  width?: number
  height?: number
}
```

## Data

```ts twoslash
import {DocId,DatetimeUTC} from "@anzusystems/common-admin"

/**
 * @property damId - DocId of the DAM asset.
 * @property type - Type of the screenshot.
 * @property width - Width of the screenshot.
 * @property height - Height of the screenshot.
 * @property contentType - Content type of the screenshot (e.g., image/jpeg).
 */
type Screenshot = {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string
}

// ---cut-before---
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
  standings: Standing[]
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
