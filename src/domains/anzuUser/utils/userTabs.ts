/**
 * The one tab that is not a system.
 *
 * A module of its own because `<script setup>` cannot export, and both the shell and the pages that
 * read `?tab=` need to name it.
 */
export const OTHER_SYSTEMS_TAB = '__otherSystems'
