import { type Component, defineComponent, h, type PropType } from 'vue'
import AUserAndTimeTrackingFields from '@/domains/ui/components/AUserAndTimeTrackingFields.vue'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import type { UserAndTimeTrackingData, UserAndTimeTrackingUsers } from '@/shared/types/UserAndTimeTracking'

export interface CreateUserAndTimeTrackingFieldsOptions<U extends AnzuUserMinimal = AnzuUserMinimal> {
  /**
   * The admin's user cache composable, e.g. its `useCachedUsers`. Invoked inside the component's
   * setup, once, so the cache resolves in component scope.
   */
  useCachedUsers: () => UserAndTimeTrackingUsers<U>
  /** Named route of a user's detail (e.g. `'/(common)/users/[id]'`); without it the chip is no link. */
  userRouteName?: string
  /** A user's detail in another admin, `:id` replaced; opens in a new tab. */
  userExternalUrlTemplate?: string
  /** The chip's label, for users that carry a better one than `person.fullName`. */
  userTitleFn?: (user: CachedItem<U>) => string
  /** Component name for devtools / warnings. */
  name?: string
}

/**
 * Builds an admin's created / modified rows from its user cache and routes, so each admin's
 * `XTrackingFields.vue` is a single factory call over `AUserAndTimeTrackingFields`, as each
 * `CachedXChip.vue` is over `ACachedChip`. `hide-*` and the `user` slot fall through.
 *
 * Use in an SFC's plain `<script lang="ts">` (not `setup`):
 * ```ts
 * export default createUserAndTimeTrackingFields({
 *   useCachedUsers,
 *   userRouteName: '/(common)/users/[id]',
 * })
 * ```
 */
export function createUserAndTimeTrackingFields<U extends AnzuUserMinimal = AnzuUserMinimal>(
  options: CreateUserAndTimeTrackingFieldsOptions<U>
): Component {
  return defineComponent({
    name: options.name ?? 'UserAndTimeTrackingFields',
    inheritAttrs: false,
    props: {
      data: { type: Object as PropType<UserAndTimeTrackingData>, required: true },
    },
    setup(props, { attrs, slots }) {
      const users = options.useCachedUsers()
      return () =>
        h(
          AUserAndTimeTrackingFields,
          {
            data: props.data,
            users,
            userRouteName: options.userRouteName,
            userExternalUrlTemplate: options.userExternalUrlTemplate,
            userTitleFn: options.userTitleFn,
            ...attrs,
          },
          slots
        )
    },
  })
}
