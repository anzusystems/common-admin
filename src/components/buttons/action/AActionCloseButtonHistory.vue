<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRouteHistory } from '@/composables/system/routeHistory'
import { useDatatablePageStore } from '@/composables/system/datatablePageStore'

const props = withDefaults(
  defineProps<{
    /**
     * Route names that are not a destination -- the sibling views of the record being closed and
     * the create form it may have been reached from. The route the button sits on is skipped
     * anyway, so it does not belong here.
     */
    skipRouteNames?: string[]
    fallbackRouteName?: string
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
const { setPreservePage } = useDatatablePageStore()

const onClick = () => {
  setPreservePage()
  navigateBack(router, {
    skipRouteNames: props.skipRouteNames,
    fallbackRouteName: props.fallbackRouteName,
    fallbackRouteParams: props.fallbackRouteParams,
  })
}
</script>

<template>
  <VBtn
    :class="buttonClass"
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
