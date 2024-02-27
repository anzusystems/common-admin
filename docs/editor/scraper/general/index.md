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
- [fb_post](/editor/scraper/fb_post/)
- [fb_video](/editor/scraper/fb_video/)
- [flr_visual](/editor/scraper/flr_visual/)
- [ig_post](/editor/scraper/ig_post/)
- [pb_episode](/editor/scraper/pb_episode/)
- [sc_track](/editor/scraper/sc_track/)
- [sfy_episode](/editor/scraper/sfy_episode/)
- [ta3_video](/editor/scraper/ta3_video/)
- [tw_post](/editor/scraper/tw_post/)
- [tt_video](/editor/scraper/tt_video/)
- [vm_video](/editor/scraper/vm_video/)
- [yt_video](/editor/scraper/yt_video/)
