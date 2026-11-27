# google_document: Google Document

Shared types (`Screenshot`, `DatetimeUTC`): see [README](README.md#shared-types).

## Supported codes

### URL

```
https://docs.google.com/document/d/1Bayy4m_peeMvfvk0SERmJS2eV2W5rvq2t-vGNSg-tqk/edit?usp=sharing
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
