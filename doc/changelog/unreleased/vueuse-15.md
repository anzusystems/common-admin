planned
===

### Changed

- **`@vueuse/core` and `@vueuse/integrations` peer ranges move to `^15.0.0`** (from `^14.1.0`).
  Consumers upgrade in step. Five of the six v15 breaking changes do not reach this library:
  `templateRef` was dropped, but nothing here used it — the components that hold element refs use
  Vue's own `useTemplateRef`; the deprecated timer options removed in favour of `scheduler` belong to
  `useCountdown`, `useElementByPoint`, `useMemory`, `useNow`, `useTimeAgo`, `useTimestamp`,
  `useVibrate` and `useWebSocket`'s `heartbeat.interval`, and none of those are used or configured
  here — `damNotifications` runs `useWebSocket` without a heartbeat; `useEventSource` and
  `useIDBKeyval` are unused; and Node 20 support was dropped where CI and the release workflow
  already run 24.

- **`ADatatablePagination` pins its throttle to the leading edge.** The sixth breaking change is
  `useThrottleFn`, whose `trailing` default flipped from `false` to `true`. The four page buttons
  throttle at 300 ms as a click-spam guard, so under the new default a burst would replay the last
  click when the window closed: prev/next stepped two pages instead of one, and next could run past
  `lastPage`, since the queued callback never re-reads `disabledNext` — by then the fetch has
  resolved and the button is disabled. They now pass `trailing: false` explicitly and behave as
  before. `watchThrottled` in `FilterBookmarks` is untouched by the change; it has always defaulted
  `trailing` to true.

### Fixed

- Three upstream fixes land in paths this library uses, with no change needed here: `useWebSocket`
  now ignores messages from a superseded socket, which is the leak `damNotifications` guards its
  `open()` against; `useResizeObserver` guards `observe()` with an `instanceof Element` check, so a
  `v-if` root that resolves to a comment node no longer throws in the cropper and
  `FilterBookmarks`; and `useFetch` discards a stale success response once a newer request starts.
