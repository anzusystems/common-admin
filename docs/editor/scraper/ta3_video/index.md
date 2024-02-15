# ta3_video

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
}

interface Screenshot {
  damId: string; // UUID
  type: string;
  width: number;
  height: number;
  contentType: string; // e.g. image/png
}
```
