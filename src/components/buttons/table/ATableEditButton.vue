<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    routeName: string
    recordId?: number | string | undefined
    routeParams?: any | undefined
    buttonT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    recordId: undefined,
    routeParams: undefined,
    buttonT: 'common.button.edit',
    buttonClass: 'ml-1',
    dataCy: 'table-edit',
  }
)

const { t } = useI18n()

const routerToComputed = computed(() => {
  if (!isUndefined(props.routeParams)) {
    return { name: props.routeName, params: { ...props.routeParams } }
  }
  return { name: props.routeName, params: { id: props.recordId } }
})
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :to="routerToComputed"
    icon
    size="x-small"
    variant="text"
    @click.stop="() => {}"
  >
    <VIcon icon="mdi-pencil" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
  </VBtn>
</template>
