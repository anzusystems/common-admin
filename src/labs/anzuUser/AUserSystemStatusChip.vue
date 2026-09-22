<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  resolveUserSystemState,
  UserSystemState,
  type UserSystemAxes,
  type UserSystemStateType,
} from '@/labs/anzuUser/userSystemState'

const props = defineProps<{
  axes: UserSystemAxes
}>()

const { t } = useI18n()

const state = computed<UserSystemStateType>(() => resolveUserSystemState(props.axes))

/**
 * One definition, one set of colours, one set of icons -- shown in the "other systems" table, in a
 * cross-system row, in a bulk-action row and in the log. A text chip rather than a hover tooltip:
 * a tooltip does not exist on touch, cannot be scanned down a column, and would let "no account
 * here" and "no access" look nearly the same.
 */
const APPEARANCE: Record<UserSystemStateType, { color: string; icon: string; muted: boolean }> = {
  [UserSystemState.Loading]: { color: 'default', icon: 'mdi-dots-horizontal', muted: true },
  [UserSystemState.Enabled]: { color: 'success', icon: 'mdi-check-circle-outline', muted: false },
  [UserSystemState.Disabled]: { color: 'warning', icon: 'mdi-alert-circle-outline', muted: false },
  [UserSystemState.Absent]: { color: 'default', icon: 'mdi-close-circle-outline', muted: false },
  [UserSystemState.Forbidden]: { color: 'default', icon: 'mdi-cancel', muted: false },
  [UserSystemState.Unavailable]: { color: 'error', icon: 'mdi-alert-outline', muted: false },
  [UserSystemState.ConfigDisabled]: { color: 'default', icon: 'mdi-cancel', muted: true },
}

const appearance = computed(() => APPEARANCE[state.value])
</script>

<template>
  <VChip
    :color="appearance.color"
    :prepend-icon="appearance.icon"
    :class="{ 'text-disabled': appearance.muted }"
    :data-cy="`user-system-state-${state}`"
    label
    size="small"
  >
    {{ t(`common.userSystem.state.${state}`) }}
  </VChip>
</template>
