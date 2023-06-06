<script lang="ts" setup>
import { COMMON_CONFIG } from '@/model/commonConfig'
</script>

<template>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
    label
    size="small"
    @click.stop=""
  >
    external link
  </VChip>
</template>
