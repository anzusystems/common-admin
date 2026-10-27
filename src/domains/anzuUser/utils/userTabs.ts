/**
 * The one tab that is not a system.
 * Its own module because `<script setup>` cannot export, and both the shell and the pages reading `?tab=` need it.
 */
export const OTHER_SYSTEMS_TAB = '__otherSystems'
