# flr_visual - Flourish Visualisation

## Supported codes

### URL

```
https://public.flourish.studio/visualisation/8830543/ 
```

### Embed

```html
<div class="flourish-embed flourish-chart" data-src="visualisation/8830543"><script src="https://public.flourish.studio/resources/embed.js"></script></div> 
```

## Params

```ts
interface Params {
  id: string
  width: number // optional
  height: number // optional
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[];
  scrapedAt: string; // datetime in RFC 3339 format
  title: string;
  subtitle: string;
}

interface Screenshot {
  damId: string; // UUID
  type: string;
  width: number;
  height: number;
  contentType: string; // e.g. image/png
}
```
