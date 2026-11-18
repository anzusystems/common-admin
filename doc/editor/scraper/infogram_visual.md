# infogram_visual: Infogram Visual

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://infogram.com/ako-sa-vyvija-spolupraca-slovenska-so-spojenym-kralovstvom-1hxj48m8g3py52v
```

### Embed responsive async

```html
<div class="infogram-embed" data-id="f1844e3b-b0cc-4251-95ee-b221e1acb836" data-type="interactive" data-title="Ako sa vyvíja spolupráca Slovenska so Spojeným kráľovstvom?"></div><script>!function(e,n,i,s){var d="InfogramEmbeds";var o=e.getElementsByTagName(n)[0];if(window[d]&&window[d].initialized)window[d].process&&window[d].process();else if(!e.getElementById(i)){var r=e.createElement(n);r.async=1,r.id=i,r.src=s,o.parentNode.insertBefore(r,o)}}(document,"script","infogram-async","https://e.infogram.com/js/dist/embed-loader-min.js");</script>
```

### Embed responsive

```html
<script id="infogram_0_f1844e3b-b0cc-4251-95ee-b221e1acb836" title="Ako sa vyvíja spolupráca Slovenska so Spojeným kráľovstvom?" src="https://e.infogram.com/js/dist/embed.js?Sts" type="text/javascript"></script>
```

### Embed responsive iframe

```html
<div style="position: relative; width: 100%; height: 0px; padding: 100% 0px 0px; overflow: hidden; will-change: transform;"><iframe loading="lazy" src="https://e.infogram.com/f1844e3b-b0cc-4251-95ee-b221e1acb836?src=embed&amp;embed_type=responsive_iframe" title="Ako sa vyvíja spolupráca Slovenska so Spojeným kráľovstvom?" allowfullscreen="" allow="fullscreen" style="position: absolute; width: 100%; height: 100%; top: 0px; left: 0px; border-width: medium; border-style: none; border-color: currentcolor; border-image: none; padding: 0px; margin: 0px;"></iframe></div>
```

### Embed fixed

```html
<iframe src="https://e.infogram.com/f1844e3b-b0cc-4251-95ee-b221e1acb836?src=embed" title="Ako sa vyvíja spolupráca Slovenska so Spojeným kráľovstvom?" width="1080" height="4092" scrolling="no" frameborder="0" style="border:none;" allowfullscreen="allowfullscreen"></iframe>
```

## Params

```ts
/**
 * @property id - UUID of the visual, the URL is resolved to it via Infogram oEmbed.
 * @property width - Width from the fixed embed.
 * @property height - Height from the fixed embed.
 */
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
