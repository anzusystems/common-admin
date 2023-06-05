<script lang="ts" setup>
import AChipNoLink from '@/components/AChipNoLink.vue'
import { COMMON_CONFIG } from '@/model/commonConfig'
</script>

<template>
  <AChipNoLink class="mr-2">draft</AChipNoLink>
  <AChipNoLink
    class="mr-2"
    color="success"
    >published</AChipNoLink
  >
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
    label
    size="small"
    @click.stop=""
    class="mr-2"
  >
    internal link
  </VChip>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
    label
    size="small"
    @click.stop=""
  >
    external link
  </VChip>
</template>
