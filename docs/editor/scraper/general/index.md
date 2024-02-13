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
- [flr_visual](/editor/scraper/flr_visual/)
- [ta3_video](/editor/scraper/ta3_video/)
- [tw_post](/editor/scraper/tw_post/)
- [vm_video](/editor/scraper/vm_video/)
- [yt_video](/editor/scraper/yt_video/)
