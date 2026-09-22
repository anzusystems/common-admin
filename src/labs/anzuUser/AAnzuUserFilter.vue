<script lang="ts" setup>
import { inject } from 'vue'
import type { AxiosInstance } from 'axios'
import AFilterString from '@/labs/filters/AFilterString.vue'
import AFilterWrapper from '@/labs/filters/AFilterWrapper.vue'
import type { FilterStoreIdentifier } from '@/labs/filters/filterFactory'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import type { IntegerIdNullable } from '@/types/common'
import { isUndefined } from '@/utils/common'

withDefaults(
  defineProps<{
    /**
     * Both are what switches the bookmark UI on in `AFilterWrapper`, and both have to be there for
     * it to appear -- bookmarks are stored per user. Left unset, the filter is drawn without them,
     * which is what admin-inhouse, blog and forum have.
     */
    client?: (() => AxiosInstance) | undefined
    userId?: IntegerIdNullable | undefined
    /**
     * What the saved bookmarks are filed under on the server.
     *
     * Left unset it is the filter's own `common` / `anzuUser`. cms overrides it with the pair its
     * old list used, so the bookmarks operators already have keep showing up -- the field names are
     * the same, and a new key would simply orphan them.
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
      Every other slot straight through, so a system's own field can bring its own widget: the
      generic renderer draws a plain input, and a permission group or a site is a remote
      autocomplete that only the app can build.
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
