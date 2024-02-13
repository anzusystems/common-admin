# embedWeather

## Features
- user can insert locationId by putting it into input
- user can select location using search input

## Node schema

```json
{
  "name": "embedWeather",
  "groups": [
    "embed"
  ],
  "attrs": {
    "id": {
      "default": "" // string (uuid of embed)
    },
    "changeId": {
      "default": "" // string
    }
  }
}
```

## Node JSON example

```json
{
  "type": "doc",
  "content": [
    {
      "type": "embedWeather",
      "attrs": {
        "id": "6dec11fb-34b2-42ec-8bc4-0bba216158a8",
        "changeId": "dc62ffef-ccb8-4ac4-8046-406d03c5ee5d"
      }
    }
  ]
}
```

## API data

```ts
interface EmbedWeatherAware {
  id: IntegerId
  locationId: IntegerId
  variant: string // enum: day | week
}
```
