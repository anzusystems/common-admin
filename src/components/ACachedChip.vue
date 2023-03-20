<script lang="ts" setup>
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DocId, IntegerId } from '@/types/common'
import { objectGetValueByPath } from '@/utils/object'
import { isNull, isUndefined } from '@/utils/common'
import { COMMON_CONFIG } from '@/model/commonConfig'

const props = withDefaults(
  defineProps<{
    id: null | undefined | IntegerId | DocId
    containerClass?: undefined | string
    getCachedFn: (id: any) => any
    displayTextPath: string
    route: string
    disableClick?: boolean
    openInNew?: boolean
    size?: string
    forceRounded?: boolean
    textOnly?: boolean
    fallbackIdText?: boolean
  }>(),
  {
    id: null,
    containerClass: 'd-inline-flex',
    disableClick: false,
    openInNew: false,
    size: 'small',
    forceRounded: false,
    textOnly: false,
    fallbackIdText: false,
  },
)

const router = useRouter()
const cached = shallowRef<undefined | any>(undefined)
const loaded = shallowRef<boolean>(false)

const item = computed(() => {
  return props.getCachedFn(props.id as any)
})

const displayTitle = computed(() => {
  if (cached.value) {
    return objectGetValueByPath(cached.value, props.displayTextPath)
  }
  return props.fallbackIdText ? props.id : ''
})

const onClick = () => {
  router.push({ name: props.route, params: { id: props.id } })
}

watch(
  item,
  async (newValue) => {
    if (loaded.value) return
    if (isUndefined(newValue) || newValue._loaded === false) return
    cached.value = newValue
    loaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div :class="containerClass">
    <template v-if="isNull(id) || isUndefined(id)">
      <slot name="empty">
        -
      </slot>
    </template>
    <div v-else-if="textOnly">
      {{ displayTitle }}
      <VProgressCircular
        v-if="!loaded"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </div>
    <VChip
      v-else-if="disableClick"
      :size="size"
      :label="forceRounded ? undefined : true"
    >
      {{ displayTitle }}
      <VProgressCircular
        v-if="!loaded"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </VChip>
    <VChip
      v-else
      :size="size"
      :append-icon="openInNew ? COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL : COMMON_CONFIG.CHIP.ICON.LINK"
      :label="forceRounded ? undefined : true"
      @click.stop="onClick"
    >
      {{ displayTitle }}
      <VProgressCircular
        v-if="!loaded"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </VChip>
  </div>
</template>
