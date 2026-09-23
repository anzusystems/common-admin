# flourish_visual: Flourish Visualisation

## Supported codes

### URL

```
https://public.flourish.studio/visualisation/8830543/ 
```

### Embed

```html
<div class="flourish-embed flourish-chart" data-src="visualisation/8830543"><script src="https://public.flourish.studio/resources/embed.js"></script></div> 
<iframe src='https://flo.uri.sh/visualisation/16111676/embed' title='Interactive or visual content' class='flourish-embed-iframe' frameborder='0' scrolling='no' style='width:100%;height:600px;' sandbox='allow-same-origin allow-forms allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'></iframe>
<amp-iframe sandbox='allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation' layout=responsive resizable noloading title='Interactive or visual content' src='https://flo.uri.sh/visualisation/16111676/embed?auto=1' width=400 height=300><amp-img layout=fixed height=64 width=64 src='https://public.flourish.studio/resources/bosh.svg' placeholder style='margin: auto'></amp-img><div overflow style='position: absolute; bottom: 0; width: 100%; text-align: center; background: #eee; font-family: sans-serif;'>Show more</div></amp-iframe>
```

## Params

```ts twoslash
interface Params {
  id: string
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
  title?: string
  subtitle?: string
}
```
