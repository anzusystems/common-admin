# slido_poll: Slido Poll

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://app.sli.do/event/fh8EBR1TV8HdHxDpahHs1W/embed/polls/5abc998f-6811-4d99-820b-39dab88b45b5
```

### Embed

```html
<iframe src="https://app.sli.do/event/fh8EBR1TV8HdHxDpahHs1W/embed/polls/5abc998f-6811-4d99-820b-39dab88b45b5" width="300" height="400"></iframe>
```

## Params

```ts
interface Params {
  id: string
  subId: string
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title?: string
}
```
