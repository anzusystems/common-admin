# ta3_video -  TA3 Video

## Supported codes

### URL

```
https://www.ta3.com/embed/20191010-hw-bae91537-77da-44e5-96dc-08ac3b0a6b90 
```

### Embed

```html
<iframe src='https://www.ta3.com/embed/20240227-hw-249f3b65-dd91-4031-9c76-edb8bc35f80d' width='750' height='422' frameborder='0' scrolling='no'></iframe>
```


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
