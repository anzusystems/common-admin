<script lang="ts" setup>
import { inject } from 'vue'
import type { AxiosInstance } from 'axios'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import AFilterWrapper from '@/domains/filters/components/AFilterWrapper.vue'
import type { FilterStoreIdentifier } from '@/domains/filters/composables/filterFactory'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import type { IntegerIdNullable } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

withDefaults(
  defineProps<{
    /**
     * Both are needed to switch on the bookmark UI in `AFilterWrapper`, because
     * bookmarks are stored per user. Left unset, the filter has no bookmarks.
     */
    client?: (() => AxiosInstance) | undefined
    userId?: IntegerIdNullable | undefined
    /**
     * What the saved bookmarks are filed under on the server. Defaults to `common` / `anzuUser`.
     * cms overrides it with the pair its old list used, so existing
     * bookmarks keep showing up. A new key would orphan them.
     */
    store?: FilterStoreIdentifier | undefined
  }>(),
  {
    client: undefined,
    userId: undefined,
    store: undefined,
  }
)

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

/** The column set a bookmark restores along with the filter values. */
const datatableHiddenColumns = defineModel<string[] | undefined>('datatableHiddenColumns', {
  default: undefined,
  required: false,
})

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('[AAnzuUserFilter] Incorrect provide/inject config.')
}
</script>

<template>
  <AFilterWrapper
    v-model:datatable-hidden-columns="datatableHiddenColumns"
    :client="client"
    :user-id="userId"
    :store="store ?? true"
    @submit="emit('submit')"
    @reset="emit('reset')"
    @bookmark-load-after="emit('submit')"
  >
    <template #search>
      <AFilterString name="email" />
    </template>
    <!--
      Pass every other slot through, so a system field can bring its own widget.
      The generic renderer draws a plain input. A permission group or
      site needs a remote autocomplete that only the app can build.
    -->
    <template
      v-for="(_, name) in $slots"
      :key="name"
      #[name]="slotProps"
    >
      <slot
        :name="name"
        v-bind="slotProps ?? {}"
      />
    </template>
  </AFilterWrapper>
</template>
