<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

const props = withDefaults(
  defineProps<{
    returnRouteName: string
  }>(),
  {}
)

const { t } = useI18n()
const router = useRouter()
const { navigateBack } = useRouteHistory()
const { preservePageForLanding } = useDatatablePageStore()

// A mistyped or stale record address lands here, so the way back to the list it came from is worth a
// button of its own. The home route is the fallback: in a tab opened on the bad address there is no
// history, and `router.back()` would leave the application.
const goBack = () => {
  const closing = navigateBack(router, { fallbackRouteName: props.returnRouteName })
  preservePageForLanding(router, closing)
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
