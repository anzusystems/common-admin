<script lang="ts" setup>
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
    buttonT: 'common.button.detail',
    buttonClass: 'ml-1',
    target: '_self',
    dataCy: 'table-detail',
  }
)
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
    <VIcon icon="mdi-information-outline" />
    <VTooltip activator="parent" location="bottom">Detail</VTooltip>
  </VBtn>
</template>
