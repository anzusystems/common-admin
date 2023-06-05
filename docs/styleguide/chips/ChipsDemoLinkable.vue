<script lang="ts" setup>
import { COMMON_CONFIG } from '@/model/commonConfig'
</script>

<template>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
    label
    size="small"
    @click.stop=""
  >
    internal link
  </VChip>
</template>
