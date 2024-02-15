# vm_video

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
  author: Author;
  publishedAt: string; // datetime in RFC 3339 format
  images: Image[];
  status: string;
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
