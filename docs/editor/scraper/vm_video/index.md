# vm_video - Vimeo Video

## Supported codes

### URL

```
https://vimeo.com/798891880 
```

### Embed

```html
<iframe src="https://player.vimeo.com/video/798891880?h=1ddb1aa75b" width="640" height="320" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
<p><a href="https://vimeo.com/798891880">Another Young Couple</a> from <a href="https://vimeo.com/barryjenkins">Barry Jenkins</a> on <a href="https://vimeo.com">Vimeo</a>.</p> 
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
  url: string;
  title: string;
  text: string;
  author: Author;
  publishedAt: string; // datetime in RFC 3339 format
  images: Image[];
}

interface Screenshot {
  damId: string; // UUID
  type: string;
  width: number;
  height: number;
  contentType: string; // e.g. image/png
}

interface Author {
  name: string;
  image: ImageVariant;
  url: string;
}

interface ImageVariant {
  url: string;
  damId: string; // UUID
  width: number;
  height: number;
  contentType: string;  // e.g. image/jpeg
}

interface Image {
  variants: ImageVariant[];
}
```
