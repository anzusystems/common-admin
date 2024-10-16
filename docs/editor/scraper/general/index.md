# Scraper

- used to "scrape" all 3rd party codes (like yt embed, fb embed etc.) and save it in structured format
- also used to "scrape" its data (like screenshot of embed in specific language, store raw texts, author, etc.)

## EmbedExternal
- See [EmbedExternal](/editor/nodes/embed-external/)
- `type` field is same enum as in scraper
- `params` field contains scraped params from embed code
- `data` field contains scraped data from embed, it's async process, so it can take some time to fill these data by scraper
- `scrapeStatus` field represent the status of scraping:
  - unassigned: default status, specially old content with non-scraped data
  - pending: status after new embed is created and waiting for scrape process
  - error: error occurred in scraper
  - done: scraping done, data field is filled

## Supported types:
- [dailymotion_video](/editor/scraper/dailymotion_video/)
- [facebook_post](/editor/scraper/facebook_post/)
- [facebook_video](/editor/scraper/facebook_video/)
- [flourish_story](/editor/scraper/flourish_story/)
- [flourish_visual](/editor/scraper/flourish_visual/)
- [google_document](/editor/scraper/google_document/)
- [google_map](/editor/scraper/google_map/)
- [google_mymap](/editor/scraper/google_mymap/)
- [idnes_video](/editor/scraper/idnes_video/)
- [iframe_basic](/editor/scraper/iframe_basic/)
- [instagram_post](/editor/scraper/instagram_post/)
- [instagram_reel](/editor/scraper/instagram_reel/)
- [jw_video](/editor/scraper/jw_video/)
- [pinterest_pin](/editor/scraper/pinterest_pin/)
- [podbean_episode](/editor/scraper/podbean_episode/)
- [scribd_document](/editor/scraper/scribd_document/)
- [seznam_map](/editor/scraper/seznam_map/)
- [soundcloud_track](/editor/scraper/soundcloud_track/)
- [spotify_episode](/editor/scraper/spotify_episode/)
- [ta3_video](/editor/scraper/ta3_video/)
- [tableau_visual](/editor/scraper/tableau_visual/)
- [tiktok_video](/editor/scraper/tiktok_video/)
- [twitter_post](/editor/scraper/twitter_post/)
- [vimeo_video](/editor/scraper/vimeo_video/)
- [youtube_video](/editor/scraper/youtube_video/)
