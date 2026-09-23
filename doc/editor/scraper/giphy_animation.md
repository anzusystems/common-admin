# giphy_animation: Giphy Animation

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2M5bm9xbjZ6cXJneWF2c2Rkb2V4a2tneDIzcTFobjFjYzd5dHptNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iibH5ymW6LFvSIVyUc/giphy.gif
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQybWtqaWlzZ2ZyOXRjNnAwYWF5NXo1enV6aHI3NjZycHU0amx0MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iibH5ymW6LFvSIVyUc/giphy-downsized.gif
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQybWtqaWlzZ2ZyOXRjNnAwYWF5NXo1enV6aHI3NjZycHU0amx0MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iibH5ymW6LFvSIVyUc/giphy.mp4
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQybWtqaWlzZ2ZyOXRjNnAwYWF5NXo1enV6aHI3NjZycHU0amx0MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iibH5ymW6LFvSIVyUc/giphy.webp
```

### Embed

```html
<iframe src="https://giphy.com/embed/iibH5ymW6LFvSIVyUc" width="462" height="480" style="" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="https://giphy.com/gifs/wednesday-wed-happy-iibH5ymW6LFvSIVyUc">via GIPHY</a></p>
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
  url?: string
  title?: string
}
```
