# sc_track

## Params

```ts
interface Params {
  id: string
  height: number // optional
  color: string // optional, hexadecimal color code
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[];
  scrapedAt: string; // datetime in RFC 3339 format
  title: string;
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
  username: string;
  image: ImageVariant;
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
