import type { RouteLocationRaw } from 'vue-router'

/**
 * The one tab that is not a system.
 * Its own module because `<script setup>` cannot export, and both the shell and the pages naming the active tab need it.
 */
export const OTHER_SYSTEMS_TAB = '__otherSystems'

/** A tab of `AUserTabsShell`: a system this admin manages and the address of its user page here. */
export interface UserSystemTab {
  system: string
  to: RouteLocationRaw
}
