# sofascore_totw: Sofascore Team of the Week

## Supported codes

### Embed

```html
<iframe id="sofa-totw-embed-17-61627-18400" width="100%" height="598" style="display:block;max-width:700px" src="https://widgets.sofascore.com/embed/unique-tournament/17/season/61627/round/18400/teamOfTheWeek?showCompetitionLogo=true&widgetTheme=light&widgetTitle=Premier%20League" frameBorder="0" scrolling="no"></iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
  tournamentId: number
  seasonId: number
  roundId: number
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
}
```
