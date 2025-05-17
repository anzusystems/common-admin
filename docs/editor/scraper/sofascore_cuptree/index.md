# sofascore_cuptree: Sofascore Cup Tree

## Supported codes

### Embed

```html
<iframe id="sofa-cupTree-embed-234-63409-10817984" src="https://widgets.sofascore.com/embed/unique-tournament/234/season/63409/cuptree/10817984?widgetTitle=24/25 NHL playoffs&showCompetitionLogo=true&widgetTheme=light" style=height:696px!important;max-width:700px!important;width:100%!important; frameborder="0" scrolling="yes"></iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
  tournamentId: number
  seasonId: number
  cuptreeId: number
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
