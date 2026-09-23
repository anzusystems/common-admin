# google_mymap: Google My Map

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://www.google.com/maps/d/u/0/viewer?mid=1jQmjbJwq-jWYdJRQZm8P7omVqZIijUw&ll=49.24311676587614%2C20.625683100000032&z=11
https://www.google.com/maps/d/u/0/viewer?hl=en&mid=1TI2LZ3-yGVVWdJ5quw0Biy9ZPxKAXNfA&ll=51.746703469417156%2C20.584473624571956&z=14
```

### Embed

```html
<iframe src="https://www.google.com/maps/d/embed?mid=1jQmjbJwq-jWYdJRQZm8P7omVqZIijUw&ehbc=2E312F" width="640" height="480"></iframe>
<iframe src="https://www.google.com/maps/d/u/2/embed?mid=17H-gvOLLcTrt4K-khvAP6bQckwHdi18&ehbc=2E312F" width="640" height="480"></iframe>
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
  description?: string
}
```
