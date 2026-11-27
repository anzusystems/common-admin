<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSessionEnd } from '@/domains/auth/composables/sessionEnd'

const { sessionEnded, leave } = useSessionEnd()
const { t } = useI18n()

const signInInNewTab = () => {
  window.open('/login', '_blank', 'noopener')
}
</script>

<template>
  <VAppBar
    v-if="sessionEnded"
    height="48"
    color="red-darken-1"
    elevation="0"
    :order="-1"
  >
    <div
      class="text-center w-100 text-body-small"
      data-cy="session-ended-bar"
      role="alert"
    >
      {{ t('common.system.sessionEnded.text') }}
      <VBtn
        class="text-none text-decoration-underline ml-1"
        variant="text"
        size="small"
        data-cy="session-ended-sign-in-new-tab"
        @click.stop="signInInNewTab"
      >
        {{ t('common.system.sessionEnded.signInInNewTab') }}
      </VBtn>
      <VBtn
        class="text-none text-decoration-underline"
        variant="text"
        size="small"
        data-cy="session-ended-leave"
        @click.stop="leave"
      >
        {{ t('common.system.sessionEnded.leave') }}
      </VBtn>
    </div>
  </VAppBar>
</template>
