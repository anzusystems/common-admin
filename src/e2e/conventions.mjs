// What the route walk knows of common-admin's views. Apart from the walk, which is node code, so that a browser
// test can hold them against the components (src/test/routeWalkConventions.test.ts).

/** `ACard`'s loader, shown while the card loads. */
export const CARD_LOADER_SELECTOR = '.a-card-loader'

/** The back button of `ANotFoundView`. */
export const NOT_FOUND_SELECTOR = '[data-cy="not-found-back"]'

/** The rows of a listing: Vuetify's data table, without its "no data" and loading rows. */
export const ROW_SELECTOR =
  'main .v-data-table tbody tr:not(.v-data-table-rows-no-data):not(.v-data-table-rows-loading)'

/** The row a listing without records shows. */
export const NO_DATA_SELECTOR = 'main .v-data-table-rows-no-data'
