<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    recordId: number | string
    routeName: string
    buttonT?: string
    buttonClass?: string
    target?: string
    dataCy?: string
  }>(),
  {
    buttonT: 'common.button.edit',
    buttonClass: 'ml-1',
    target: '_self',
    dataCy: 'table-edit',
  }
)

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :target="target"
    :to="{ name: routeName, params: { id: recordId } }"
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
