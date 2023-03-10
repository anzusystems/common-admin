<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import { isNumber, isString } from '@/utils/common'
import { numberToString } from '@/utils/number'
import { useAlerts } from '@/composables/system/alerts'
import AIconGroup from '@/components/AIconGroup.vue'

const props = withDefaults(
  defineProps<{
    id: number | string
    buttonT?: string
    buttonClass?: string
    iconT?: string
    notifyT?: string
    dataCy?: string
    size?: 'small' | 'x-small'
  }>(),
  {
    buttonT: 'common.button.copyId',
    buttonClass: 'ml-1',
    iconT: 'common.button.id',
    notifyT: 'common.alert.idWasCopied',
    dataCy: 'table-copy',
    size: 'x-small',
  }
)

const { t } = useI18n()
const { copy, isSupported } = useClipboard()
const { showSuccess } = useAlerts()

const onClick = (event: Event) => {
  eventClickBlur(event)
  if (isNumber(props.id) && props.id > 0) {
    copy(numberToString(props.id)).then(() => {
      showSuccess(t(props.notifyT))
    })
  } else if (isString(props.id) && props.id.length) {
    copy(props.id).then(() => {
      showSuccess(t(props.notifyT))
    })
  }
}
</script>

<template>
  <VBtn
    v-if="isSupported"
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    :size="size"
    variant="text"
    @click.stop="onClick"
  >
    <AIconGroup
      :secondary-text="t(iconT)"
      main-icon="mdi-content-copy"
      size="small"
    />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
  </VBtn>
</template>
