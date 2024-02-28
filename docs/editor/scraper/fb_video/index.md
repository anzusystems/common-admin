# fb_video: Facebook Video

## Supported codes

### URL

```
https://www.facebook.com/JamesBond007AUS/videos/2427034044136560/ 
```

### Embed

```
<iframe src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2Fkinolumiere%2Fvideos%2F677144637698465%2F&show_text=false&width=560&t=0" width="560" height="314" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>
```



## Params

```ts
interface Params {
  id: string
  username: string
  startTime: number // optional, start time in seconds
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
  text: string;
  author: Author;
  images: Image[];
  videos: Video[];
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

interface VideoVariant {
  url: string;
  bitrate: number;
  contentType: string;  // e.g. video/mp4
}

interface Video {
  variants: VideoVariant[];
}
```
