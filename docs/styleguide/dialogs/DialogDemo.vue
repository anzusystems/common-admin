<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { ref } from 'vue'

const fullDialog = ref(false)
</script>

<template>
  <VBtn
    color="primary"
    @click.stop="fullDialog = true"
  >
    Open
  </VBtn>
  <VDialog :model-value="fullDialog" :max-width="320">
    <VCard v-if="fullDialog">
      <ADialogToolbar @on-cancel="fullDialog = false">
        Title
      </ADialogToolbar>
      <VCardText>
        Lorem ipsum dolor sit amet. Aut quae accusantium et quia suscipit id placeat voluptatibus eos voluptatem ipsam est laboriosam nostrum in voluptates rerum. Quo impedit rerum sit maiores omnis vel internos perferendis et corporis esse vel aperiam culpa!
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click.stop="fullDialog = false"
        >
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          variant="flat"
          @click.stop=""
        >
          Confirm
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
