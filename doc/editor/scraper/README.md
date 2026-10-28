# Scraper

- used to "scrape" all 3rd party codes (like yt embed, fb embed etc.) and save it in structured format
- also used to "scrape" its data (like screenshot of embed in specific language, store raw texts, author, etc.)

## EmbedExternal
- See [EmbedExternal](../nodes/embed-external.md)
- `type` field is same enum as in scraper, the CMS enum also keeps legacy `facebook_gallery`, `facebook_photo`, `google_form`, `google_spreadsheet` (no scraper provider), web-cms renders them as `UNSUPPORTED EMBED`
- `params` field contains scraped params from embed code
- `data` field contains scraped data from embed, it's async process, so it can take some time to fill these data by scraper
- `scrapeStatus` field represent the status of scraping:
  - unassigned: default status, specially old content with non-scraped data
  - pending: status after new embed is created (or refreshed) and waiting for scrape process
  - error: error occurred in scraper
  - done: scraping done, data field is filled
- flow: admin posts the code to scraper `POST /v1/scrapes/analyze-embed` (→ `type`, `params`), creates the embed in CMS with `scrapeStatus: pending`, then `POST /v1/scrapes` with the content locale; scraper calls CMS back and CMS stores `status`, `data` and the returned `params` (so `params` can change after scraping); an open article or article template editor refreshes the embed from a notification
- refresh (embedExternal dialog, shown for done / error / unassigned) sends the stored `type` + `params` to scraper again without re-analyzing and sets `scrapeStatus` to pending
- a pasted copy of an embedExternal whose `scrapeStatus` isn't done is scraped again
- on a collapsed selection, pasting text that contains `<iframe` or `<script` (script tags are stripped first; nothing left → normal paste), or that starts with a youtube.com / youtu.be / facebook.com / x.com / twitter.com / instagram.com / public.flourish.studio URL, creates embedExternal via scraper analyze (`pasteExternalEmbedSnippet` extension); if analyze or create fails, the text is pasted as a paragraph

## Shared types

```ts
type DocId = string // common-admin DocId

type DatetimeUTC = string // common-admin DatetimeUTC, ISO 8601 in UTC

/**
 * @property damId - DocId of the DAM asset.
 * @property type - Type of the screenshot.
 * @property width - Width of the screenshot.
 * @property height - Height of the screenshot.
 * @property contentType - Content type of the screenshot (e.g., image/jpeg).
 */
type Screenshot = {
  damId: DocId
  type: string // cms client: main (614 px wide) | wide (970) | medium (433) | medium2x (433, 2x DPR)
  width: number
  height: number
  contentType: string
}

/**
 * @property url - URL of the image variant.
 * @property damId - DocId of the DAM asset.
 * @property width - Width of the image variant.
 * @property height - Height of the image variant.
 * @property contentType - Content type of the image variant (e.g., image/jpeg).
 */
type Image = {
  variants?: Array<{
    url: string
    damId?: DocId
    width: number
    height: number
    contentType: string
  }>
}

/**
 * @property url - URL of the video variant.
 * @property bitrate - bitrate of the video variant.
 * @property contentType - Content type of the video variant (e.g., video/mp4).
 */
type Video = {
  variants: Array<{
    url: string
    bitrate?: number
    contentType: string
  }>
}

/**
 * Time in seconds as integer.
 */
type Seconds = number
```

## Supported types
- [bluesky_post](bluesky_post.md)
- [dailymotion_video](dailymotion_video.md)
- [facebook_post](facebook_post.md)
- [facebook_reel](facebook_reel.md)
- [facebook_video](facebook_video.md)
- [flourish_story](flourish_story.md)
- [flourish_visual](flourish_visual.md)
- [giphy_animation](giphy_animation.md)
- [google_document](google_document.md)
- [google_map](google_map.md)
- [google_mymap](google_mymap.md)
- [idnes_video](idnes_video.md)
- [iframe_basic](iframe_basic.md)
- [instagram_post](instagram_post.md)
- [instagram_reel](instagram_reel.md)
- [jw_video](jw_video.md)
- [knightlab_juxtapose](knightlab_juxtapose.md)
- [omny_clip](omny_clip.md)
- [pinterest_pin](pinterest_pin.md)
- [podbean_episode](podbean_episode.md)
- [scribd_document](scribd_document.md)
- [seznam_map](seznam_map.md)
- [slido_event](slido_event.md)
- [slido_poll](slido_poll.md)
- [sofascore_cuptree](sofascore_cuptree.md)
- [sofascore_standing](sofascore_standing.md)
- [sofascore_totw](sofascore_totw.md)
- [soundcloud_track](soundcloud_track.md)
- [sportnet_video](sportnet_video.md)
- [spotify_episode](spotify_episode.md)
- [ta3_video](ta3_video.md)
- [tableau_visual](tableau_visual.md)
- [telegram_post](telegram_post.md)
- [tiktok_video](tiktok_video.md)
- [twitter_post](twitter_post.md)
- [twitter_video](twitter_video.md)
- [vimeo_video](vimeo_video.md)
- [youtube_video](youtube_video.md)
