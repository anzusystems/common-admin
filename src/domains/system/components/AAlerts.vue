<script lang="ts" setup>
import { nextTick, onMounted } from 'vue'
import { type AlertMessage, useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

const props = withDefaults(
  defineProps<{
    max?: number
    group?: string
    position?: string
    width?: string
    customClass?: string | undefined
  }>(),
  {
    max: 5,
    group: 'alerts',
    position: 'top center',
    width: '50%',
    customClass: undefined,
  }
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const queue = useAlertsQueue(props.group)

// The queue's own dismiss reaches only its `actions` slot. That slot stays hidden and hands it over
// here, so the close icon inside the VAlert closes the alert the way the queue's button would.
const dismissers = new WeakMap<object, () => void>()
const registerDismiss = (item: object, dismiss: () => void) => {
  dismissers.set(item, dismiss)
  return ''
}
const close = (item: object) => {
  dismissers.get(item)?.()
}

// VSnackbarQueue picks items up when the queue grows, not the ones already waiting when it mounts:
// alerts raised while no host was on the page (e.g. during start-up) are handed over again.
onMounted(() => {
  if (queue.value.length === 0) return
  const waiting = queue.value
  queue.value = []
  nextTick(() => {
    queue.value = [...waiting, ...queue.value]
  })
})
</script>

<template>
  <!-- VAlert inside the snackbar keeps the markup the admins' e2e tests select (`.v-alert`,
       `.v-alert__close`, `data-cy="page-title"`). Off Vuetify's overlay stack (a private prop, pinned
       by a test): on it, an alert becomes the top overlay and Esc no longer reaches an open dialog.
       Attributes, not a class, reach each snackbar (the queue drops `class`). -->
  <VSnackbarQueue
    v-model="queue"
    :total-visible="max"
    display-strategy="overflow"
    :location="position as any"
    :width="width"
    max-width="none"
    :gap="4"
    variant="text"
    :content-class="['a-alerts', customClass]"
    data-a-alerts-host
    :_disable-global-stack="true"
  >
    <template #text="{ item }">
      <VAlert
        :type="(item as AlertMessage).color"
        :text="(item as AlertMessage).text"
        density="compact"
        data-cy="page-title"
      >
        <template #close>
          <VIcon
            icon="mdi-close"
            :aria-label="commonT('common.button.close')"
            @click.stop="close(item)"
          />
        </template>
      </VAlert>
    </template>
    <template #actions="{ item, props: actionProps }">{{ registerDismiss(item, actionProps.onClick) }}</template>
  </VSnackbarQueue>
</template>

<style lang="scss">
@use 'sass:map';
@use 'vuetify/lib/styles/settings/_variables.scss' as vars;

// Above every dialog, also one opened after the alert, as the notifications before it were.
.v-snackbar[data-a-alerts-host] {
  z-index: 5000 !important;
}

.a-alerts.v-snackbar__wrapper {
  .v-snackbar__content {
    padding: 0;
  }

  // Only there to hand over the dismiss (see the script); the close icon is in the VAlert.
  .v-snackbar__actions {
    display: none;
  }

  // Several lines (an API validation error lists one field per line) stay several lines.
  .v-alert__content {
    white-space: pre-line;
  }

  @media #{map.get(vars.$display-breakpoints, 'md-and-down')} {
    width: 96% !important;
    min-width: 0;
  }
}
</style>
