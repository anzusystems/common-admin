<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

const props = withDefaults(
  defineProps<{
    returnRouteName: string
  }>(),
  {}
)

const { t } = useI18n()
const router = useRouter()
const { preservePageForLanding } = useDatatablePageStore()

// A mistyped or stale record address lands here, so the way back to the list it came from is worth a
// button of its own. A step back, so the browser's Back does not return to this page; the home route
// when the app has no previous entry -- a tab opened on the bad address, where `router.back()` would
// leave the application.
const goBack = () => {
  if (typeof router.options.history.state.back === 'string') {
    preservePageForLanding(router)
    router.back()
    return
  }
  const to = { name: props.returnRouteName }
  preservePageForLanding(router, { to, navigation: router.replace(to) })
}
</script>

<template>
  <div class="d-flex justify-center align-center fill-height">
    <div class="d-flex flex-column align-center">
      <h1 class="d-flex justify-center align-center text-primary">
        <VIcon
          size="x-large"
          icon="mdi-emoticon-cry"
        />
        <span>{{ t('common.system.notFound.title') }}</span>
      </h1>

      <p class="pa-4">
        {{ t('common.system.notFound.text') }}
      </p>

      <div class="d-flex flex-wrap justify-center ga-2">
        <VBtn
          color="primary"
          size="large"
          variant="outlined"
          data-cy="not-found-back"
          @click="goBack"
        >
          {{ t('common.system.notFound.previousButton') }}
        </VBtn>
        <VBtn
          :to="{ name: returnRouteName }"
          color="primary"
          size="large"
        >
          {{ t('common.system.notFound.backButton') }}
        </VBtn>
      </div>
    </div>
  </div>
</template>
