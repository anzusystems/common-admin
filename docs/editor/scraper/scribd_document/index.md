# scribd_document: Scribd Document

## Supported codes

### URL

```
https://www.scribd.com/document/542300197/Nudzov%C3%BD-stav-a-zakaz-vychadzania
```

### Embed

```html
<iframe class="scribd_iframe_embed" title="Núdzový stav a zákaz vychádzania" src="https://www.scribd.com/embeds/542300197/content?start_page=1&view_mode=scroll&access_key=key-76AHSPOBFSibBoej0VG2" tabindex="0" data-auto-height="true" data-aspect-ratio="1.7582846003898636" scrolling="no" width="100%" height="600" frameborder="0"></iframe><p  style="   margin: 12px auto 6px auto;   font-family: Helvetica,Arial,Sans-serif;   font-style: normal;   font-variant: normal;   font-weight: normal;   font-size: 14px;   line-height: normal;   font-size-adjust: none;   font-stretch: normal;   -x-system-font: none;   display: block;"   ><a title="View Núdzový stav a zákaz vychádzania on Scribd" href="https://www.scribd.com/document/542300197/Nudzov%C3%BD-stav-a-zakaz-vychadzania#from_embed"  style="text-decoration: underline;">Núdzový stav a zákaz vychád...</a> by <a title="View Dennik SME's profile on Scribd" href="https://www.scribd.com/user/11833035/Dennik-SME#from_embed"  style="text-decoration: underline;">Dennik SME</a></p>
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
  title: string
  text: string
  url: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
