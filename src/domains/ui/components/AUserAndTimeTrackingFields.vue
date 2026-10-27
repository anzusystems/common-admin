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
 * Created and modified, when and by whom, for a detail or edit form.
 * Admins use it through their own component from `createUserAndTimeTrackingFields`, which
 * supplies the user cache and user detail route. Without `users` it draws only the dates.
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
  /**
   * The user part of a row, for an admin that draws its own chip.
   */
  user?: (props: { id: IntegerId | null; field: 'createdBy' | 'modifiedBy' }) => unknown
}>()

const { t } = useI18n()
const slots = useSlots()

const hasDate = (value: string | null | undefined) => !isUndefined(value) && !isNull(value) && value !== ''

// `undefined` is a field the backend does not send (no user tracking),
// so it is hidden. `null` is sent empty, and the chip shows it as empty.
const userShown = (hidden: boolean, id: IntegerId | null | undefined) =>
  !hidden && !isUndefined(id) && (!!props.users || !!slots.user)

const createdAtShown = computed(() => !props.hideCreatedAt && hasDate(props.data.createdAt))
const modifiedAtShown = computed(() => !props.hideModifiedAt && hasDate(props.data.modifiedAt))
const createdByShown = computed(() => userShown(props.hideCreatedBy, props.data.createdBy))
const modifiedByShown = computed(() => userShown(props.hideModifiedBy, props.data.modifiedBy))

// The rows fetch their users themselves. Record loads do not fill the cache, and a save changes `modifiedBy`.
// Reads `props.data` on every run because a store replaces the whole record after
// a fetch or save. `defineCached` debounces, so chips on a page share one request.
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
