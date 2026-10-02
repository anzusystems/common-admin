<script lang="ts" setup>
import { computed, useSlots, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ARow from '@/domains/ui/components/ARow.vue'
import ADatetime from '@/domains/ui/datetime/components/ADatetime.vue'
import ACachedUserChip from '@/domains/cached/components/ACachedUserChip.vue'
import type { UserAndTimeTrackingData, UserAndTimeTrackingUsers } from '@/shared/types/UserAndTimeTracking'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import type { IntegerId } from '@/shared/types/common'
import { isNull, isUndefined } from '@/shared/utils/common'

/**
 * Created and modified -- when and by whom -- for a detail or an edit form.
 *
 * An admin does not use it directly but through its own component made by
 * `createUserAndTimeTrackingFields`, which supplies its user cache and the route to a user's detail.
 * Without `users` it draws the dates only, as it always has.
 */
const props = withDefaults(
  defineProps<{
    data: UserAndTimeTrackingData
    users?: UserAndTimeTrackingUsers | undefined
    userRouteName?: string | undefined
    userExternalUrlTemplate?: string | undefined
    // `any`: an admin's label reads its own user (a nickname), which `AnzuUserMinimal` does not have.
    userTitleFn?: ((user: CachedItem<any>) => string) | undefined
    hideCreatedAt?: boolean
    hideModifiedAt?: boolean
    hideCreatedBy?: boolean
    hideModifiedBy?: boolean
  }>(),
  {
    users: undefined,
    userRouteName: undefined,
    userExternalUrlTemplate: undefined,
    userTitleFn: undefined,
    hideCreatedAt: false,
    hideModifiedAt: false,
    hideCreatedBy: false,
    hideModifiedBy: false,
  }
)

defineSlots<{
  /** The user part of a row, for an admin that draws its own chip. */
  user?: (props: { id: IntegerId | null; field: 'createdBy' | 'modifiedBy' }) => unknown
}>()

const { t } = useI18n()
const slots = useSlots()

const hasDate = (value: string | null | undefined) => !isUndefined(value) && !isNull(value) && value !== ''

// `undefined` is a field the backend does not send (no user tracking), so it is left out; `null` is
// a field it sends empty, and the chip shows it as such.
const userShown = (hidden: boolean, id: IntegerId | null | undefined) =>
  !hidden && !isUndefined(id) && (!!props.users || !!slots.user)

const createdAtShown = computed(() => !props.hideCreatedAt && hasDate(props.data.createdAt))
const modifiedAtShown = computed(() => !props.hideModifiedAt && hasDate(props.data.modifiedAt))
const createdByShown = computed(() => userShown(props.hideCreatedBy, props.data.createdBy))
const modifiedByShown = computed(() => userShown(props.hideModifiedBy, props.data.modifiedBy))

// The rows ask for their users themselves: the detail and edit actions that load a record do not put
// its users into the cache, and a save changes `modifiedBy`. Read off `props.data` on every run,
// because a store replaces the record whole after a fetch or a save. `defineCached` debounces, so the
// rows of one page share a request with every other chip on it.
watch(
  [
    () => props.data.createdBy,
    () => props.data.modifiedBy,
    () => props.hideCreatedBy,
    () => props.hideModifiedBy,
    () => props.users,
  ],
  ([createdBy, modifiedBy, hideCreatedBy, hideModifiedBy, users]) => {
    if (!users) return
    const ids = [hideCreatedBy ? null : createdBy, hideModifiedBy ? null : modifiedBy].filter(
      (id): id is IntegerId => !!id
    )
    if (ids.length === 0) return
    users.addToCachedUsers(ids)
    users.fetchCachedUsers()
  },
  { immediate: true }
)
</script>

<template>
  <ARow
    v-if="createdAtShown || createdByShown"
    :title="t('common.model.tracking.created')"
  >
    <div class="d-flex flex-wrap align-center gc-2 gr-1">
      <ADatetime
        v-if="createdAtShown"
        :date-time="data.createdAt ?? null"
      />
      <slot
        v-if="createdByShown"
        :id="data.createdBy || null"
        name="user"
        field="createdBy"
      >
        <ACachedUserChip
          v-if="users"
          :id="data.createdBy"
          :get-cached-fn="users.getCachedUser"
          :route-name="userRouteName"
          :external-url-template="userExternalUrlTemplate"
          :title-fn="userTitleFn"
        />
      </slot>
    </div>
  </ARow>
  <ARow
    v-if="modifiedAtShown || modifiedByShown"
    :title="t('common.model.tracking.modified')"
  >
    <div class="d-flex flex-wrap align-center gc-2 gr-1">
      <ADatetime
        v-if="modifiedAtShown"
        :date-time="data.modifiedAt ?? null"
      />
      <slot
        v-if="modifiedByShown"
        :id="data.modifiedBy || null"
        name="user"
        field="modifiedBy"
      >
        <ACachedUserChip
          v-if="users"
          :id="data.modifiedBy"
          :get-cached-fn="users.getCachedUser"
          :route-name="userRouteName"
          :external-url-template="userExternalUrlTemplate"
          :title-fn="userTitleFn"
        />
      </slot>
    </div>
  </ARow>
</template>
