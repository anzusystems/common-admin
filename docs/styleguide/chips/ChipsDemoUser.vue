<script lang="ts" setup>
import { COMMON_CONFIG } from '@/model/commonConfig'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'
</script>

<template>
  <div class="d-flex align center">
    <VChip
      :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
      label
      size="small"
      @click.stop=""
      class="mr-2"
    >
      User name
    </VChip>
    <div class="d-inline-flex mr-2">
      <VChip
        class="pl-1"
        size="small"
        :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
        @click.stop=""
      >
        <VProgressCircular
          :size="12"
          :width="2"
          indeterminate
          class="ml-1"
        />
      </VChip>
    </div>
    <div class="d-inline-flex">
      <VChip
        class="pl-1"
        size="small"
        :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
        @click.stop=""
      >
        <template #prepend>
          <AAnzuUserAvatar
            :user="{
              id: 1,
              person: {
                firstName: '',
                lastName: '',
                fullName: '',
              },
              avatar: {
                color: '',
                text: 'UN',
              },
              email: '',
            }"
            container-class="mr-1"
            :size="20"
          />
        </template>
        User name
      </VChip>
    </div>
  </div>
</template>
