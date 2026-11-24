# Live listing

A list that never reloads under the user. A small request, the probe, looks for new records; the pill above the list says "3 new records" and the list changes only when the user clicks it. Pieces: `useLiveListing`, `ALiveListingPill`, and for a count in the browser tab title `useBrowserTitleBadge`.

A working example of a plain API without signals is in the playground: `src/playground/liveListingView/LiveListingView.vue` (`/view/live-listing`).

## A plain API, on a timer

```ts
const liveListing = useLiveListing<Item>({
  probe: ({ limit, signal }) => fetchNewest(appliedFilter, limit, signal),
  key: (item) => item.id,
  scope: () => appliedFilter,
  interval: LIVE_LISTING_INTERVAL,
  reload: async () => {
    pagination.value = { ...pagination.value, page: 1 }
    await loadList()
  },
})

const loadList = async () => {
  const filter = snapshotFilter()
  items.value = await fetchList(pagination, filterData, filterConfig)
  appliedFilter = filter
  liveListing.markLoaded(items.value, { newestFirst: isNewestFirst() })
}
```

```vue
<ALiveListingPill
  :count="liveListing.count.value"
  :max="liveListing.max"
  :failed="liveListing.failed.value"
  @click="liveListing.apply()"
/>
```

The pill sticks to the top of the window while the list scrolls. In a `VCard` its styles turn the card's `overflow: hidden` into `clip`, which cuts the same edges without stopping the pill; any other scroll container between the list and the window still stops it.

`LIVE_LISTING_INTERVAL` probes every 10 s in a visible browser tab and every minute in a hidden one. A probe runs at once when the user comes back to the tab, and none runs above `max` (9+) until the click.

## Rules

- **Probe.** The newest records under the filter the list was last loaded with, newest first, page 1, `limit` of them, with the given `signal` and `report: false` (a failed probe shows on the pill, not as an alert; a count or a reload already offered stays clickable). Use its own copy of the pagination and its own fetch instance, and load nothing else: no usage, no related records.
- **Key.** An autoincrement id, or a UTC datetime string in one format. A text id (`DocId`) does not order: sort the probe by `createdAt` and use `newness: 'unseen'` with `probeLimit` of the page size, so a record counts as new while it has not been listed. A record below the oldest one of a full first page is not counted: it reached the first page because listed records left the filter.
- **`markLoaded` after every full load:** a filter, a sort, page 1, the reload after the click. `newestFirst: true` when the items are page 1 sorted newest first. In another order pass `newest`, a probe started with the list request (one record, `probeLimit` with `unseen`), so a record created while the list loaded is counted; without it the baseline is fetched after the load.
- **No `markLoaded` on a switch to another page:** what counts as new stays.
- **`scope`** is what the list was loaded with (the applied filter, not the form being edited). When it changes, the baseline is set anew.
- **`reload`** fetches page 1 and reports it with `markLoaded`. A click while it runs waits for the same reload; a failed one leaves the pill as it was.

## With backend signals

Call `requestProbe()` on a signal of the listing: a burst ends in one probe, at most one per `minIntervalMs`. Call `markChanged()` when a record already listed changed (another status, moved away); the pill then offers a reload while nothing new is counted (`changed` on `ALiveListingPill`). Pass `loading`, the loading state of the list, when loads other than the click's reload report through `markLoaded` (a filter, the user's own change): a change signalled after such a load started stays offered, as the load may have read the record before it changed, also during the first load; without `loading` such a load ends every change offered, and a change before the first load is dropped. Make `interval` reactive: `false` or a long safety period while the signals arrive, `LIVE_LISTING_INTERVAL` while they cannot, and pass `degraded` to the pill after a longer outage. A timer finds new records only; changes of listed records need a signal.
