<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    routeName?: string
    routeParams?: any | undefined
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    size?: number
  }>(),
  {
    routeName: undefined,
    routeParams: undefined,
    buttonT: 'common.button.close',
    buttonClass: 'ml-2',
    dataCy: 'button-close',
    size: 36,
  }
)

const { t } = useI18n()

const routerToComputed = computed(() => {
  if (isUndefined(props.routeName)) {
    return undefined
  }
  if (!isUndefined(props.routeParams)) {
    return { name: props.routeName, params: { ...props.routeParams } }
  }
  return { name: props.routeName }
})
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :to="routerToComputed"
    icon
    size="small"
    variant="text"
    :width="size"
    :height="size"
    :active="false"
  >
    <VIcon icon="mdi-close" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t('common.button.close') }}
    </VTooltip>
  </VBtn>
</template>
