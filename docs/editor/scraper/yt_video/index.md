# yt_video: Youtube video

## Supported codes

### URL

```
https://www.youtube.com/watch?v=fJZnasCyBvY 
```

### Short URL

```
https://youtu.be/fJZnasCyBvY 
```

### Embed

```html
<iframe width="560" height="315" src="https://www.youtube.com/embed/fJZnasCyBvY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe> 
```
## Params

```ts
interface Params {
  id: string
  startTime: number // optional, start time in seconds
  width: number; // optional
  height: number; // optional
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[];
  scrapedAt: string; // datetime in RFC 3339 format
  url: string;
  title: string;
  author: Author;
}

interface Screenshot {
  damId: string; // UUID
  type: string;
  width: number;
  height: number;
  contentType: string; // e.g. image/png
}

interface Author {
  username: string;
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
