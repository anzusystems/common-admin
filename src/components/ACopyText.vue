<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { eventClickBlur } from '@/utils/event'
import { isNumber, isString } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/composables/system/alerts'
import { numberToString } from '@/utils/number'
import { withModifiers } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number | string
    notifyT?: string
    tooltipT?: string
    dataCy?: string
  }>(),
  {
    notifyT: 'common.alert.textWasCopied',
    tooltipT: 'common.button.copy',
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
    :props="{
      onClick: withModifiers((e) => onClick(e), ['stop']),
      disabled: !isSupported,
    }"
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
        v-if="tooltipT"
        activator="parent"
        location="bottom"
      >
        {{ t(tooltipT) }}
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
