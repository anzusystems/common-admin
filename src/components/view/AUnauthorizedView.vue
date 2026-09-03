<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

/**
 * `returnUrl` navigates the document instead of the router, for apps whose sticky module state
 * would survive an in-app navigation and send the user straight back here.
 */
withDefaults(
  defineProps<{
    returnRouteName?: string
    returnUrl?: string
  }>(),
  {
    returnRouteName: undefined,
    returnUrl: undefined,
  },
)

const { t } = useI18n()
</script>

<template>
  <div class="d-flex justify-center align-center fill-height">
    <div class="d-flex flex-column align-center">
      <h1 class="d-flex justify-center align-center text-primary">
        <VIcon
          size="x-large"
          icon="mdi-emoticon-cry"
        />
        <span>{{ t('common.system.unauthorized.title') }}</span>
      </h1>

      <p class="pa-4">
        {{ t('common.system.unauthorized.text') }}
      </p>

      <VBtn
        v-if="returnUrl || returnRouteName"
        v-bind="returnUrl ? { href: returnUrl } : { to: { name: returnRouteName } }"
        color="primary"
        size="large"
      >
        {{ t('common.system.unauthorized.backButton') }}
      </VBtn>
    </div>
  </div>
</template>
