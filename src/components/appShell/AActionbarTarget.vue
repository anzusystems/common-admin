<script lang="ts" setup>
import { actionbarSlot } from '@/components/appShell/teleportSlot'

const Target = actionbarSlot.Target
</script>

<template>
  <!-- The id is not how the actionbar finds its target; the admins' e2e suites select by it. -->
  <Target
    id="anzu-actionbar"
    class="d-flex w-100 align-center justify-space-between min-width-0"
  />
</template>
