<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { type RouteRecordName, useRouter } from 'vue-router'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

const props = withDefaults(
  defineProps<{
    /**
     * Route names that are not a destination: the record's sibling views and its create form.
     * The route the button is on is skipped anyway, so do not list it.
     */
    skipRouteNames?: RouteRecordName[]
    fallbackRouteName?: RouteRecordName
    fallbackRouteParams?: Record<string, any>
    buttonClass?: string
    dataCy?: string
    size?: number
  }>(),
  {
    skipRouteNames: () => [],
    fallbackRouteName: undefined,
    fallbackRouteParams: undefined,
    buttonClass: 'ml-2',
    dataCy: 'button-close',
    size: 36,
  }
)

const { t } = useI18n()
const router = useRouter()
const { navigateBack } = useRouteHistory()
const { preservePageForLanding } = useDatatablePageStore()

const onClick = () => {
  const closing = navigateBack(router, {
    skipRouteNames: props.skipRouteNames,
    fallbackRouteName: props.fallbackRouteName,
    fallbackRouteParams: props.fallbackRouteParams,
  })
  // Right after the push: its guards run first, its `afterEach` later.
  preservePageForLanding(router, closing)
}
</script>

<template>
  <VBtn
    :class="buttonClass"
    :aria-label="t('common.button.close')"
    :data-cy="dataCy"
    icon
    size="small"
    variant="text"
    :width="size"
    :height="size"
    :active="false"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-close" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t('common.button.close') }}
    </VTooltip>
  </VBtn>
</template>
