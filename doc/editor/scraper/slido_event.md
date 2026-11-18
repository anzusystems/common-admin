# slido_event: Slido Event

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://app.sli.do/event/u4ZwGpY1DaXPFKVpjcqdgJ
```

### Embed

```html
<iframe src="https://app.sli.do/event/bbEehgh5a3LswDnFAJJiP3" height="100%" width="100%" frameBorder="0" style="min-height: 560px;" allow="clipboard-write" title="Slido"></iframe>
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
  url: string
  title?: string
}
```
