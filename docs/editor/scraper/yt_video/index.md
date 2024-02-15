# yt_video

WIP

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
```
