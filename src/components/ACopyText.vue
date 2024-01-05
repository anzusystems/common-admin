<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { eventClickBlur } from '@/utils/event'
import { isNumber, isString } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/composables/system/alerts'
import { numberToString } from '@/utils/number'

const props = withDefaults(
  defineProps<{
    value: number | string
    notifyT?: string
    dataCy?: string
  }>(),
  {
    notifyT: 'common.alert.textWasCopied',
    dataCy: 'copy-text',
  }
)

const { copy, isSupported } = useClipboard()
const { showSuccess } = useAlerts()
const { t } = useI18n()

const onClick = (event: Event) => {
  eventClickBlur(event)
  if (!isSupported) return
  if (isNumber(props.value)) {
    copy(numberToString(props.value)).then(() => {
      showSuccess(t(props.notifyT))
    })
  } else if (isString(props.value) && props.value.length) {
    copy(props.value).then(() => {
      showSuccess(t(props.notifyT))
    })
  }
}
</script>

<template>
  <slot
    name="activator"
    :on-click="onClick"
    :is-supported="isSupported"
  >
    <div
      :class="{ 'cursor-pointer': isSupported }"
      :data-cy="dataCy"
      class="d-inline-flex align-center anzu-copy-text"
      @click.stop="onClick"
    >
      <span>{{ value }}</span>
      <VIcon
        v-if="isSupported"
        class="ml-1"
        size="x-small"
        icon="mdi-content-copy"
      />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        Copy
      </VTooltip>
    </div>
  </slot>
</template>

<style lang="scss">
.anzu-copy-text {
  .v-icon {
    opacity: 0;
  }

  &:hover {
    .v-icon {
      opacity: 1;
    }
  }
}
</style>
