import { type Component, defineComponent, h, type PropType } from 'vue'
import { isFunction } from '@/shared/utils/common'
import AUserAndTimeTrackingFields from '@/domains/ui/components/AUserAndTimeTrackingFields.vue'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import type { UserAndTimeTrackingData, UserAndTimeTrackingUsers } from '@/shared/types/UserAndTimeTracking'

export interface CreateUserAndTimeTrackingFieldsOptions<U extends AnzuUserMinimal = AnzuUserMinimal> {
  /**
   * The admin's user cache composable, e.g. its `useCachedUsers`.
   * Called once inside the component's setup, so the cache resolves in component scope.
   */
  useCachedUsers: () => UserAndTimeTrackingUsers<U>
  /**
   * Named route of a user's detail, e.g. `'/(common)/users/[id]'`. Without it the chip is not a link.
   * A function is read on each render, so the link can follow the current user's permission for that route.
   */
  userRouteName?: string | (() => string | undefined)
  /** URL of a user's detail in another admin, with `:id` replaced. Opens in a new tab. */
  userExternalUrlTemplate?: string
  /** The chip's label, for users that carry a better one than `person.fullName`. */
  userTitleFn?: (user: CachedItem<U>) => string
  /** Component name for devtools / warnings. */
  name?: string
}

/**
 * Builds an admin's created / modified rows from its user cache and routes.
 * Each admin's `XTrackingFields.vue` becomes one factory call over
 * `AUserAndTimeTrackingFields`. `hide-*` props and the `user` slot fall through.
 *
 * Use in an SFC's plain `<script lang="ts">`, not `setup`:
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
            userRouteName: isFunction(options.userRouteName) ? options.userRouteName() : options.userRouteName,
            userExternalUrlTemplate: options.userExternalUrlTemplate,
            userTitleFn: options.userTitleFn,
            ...attrs,
          },
          slots
        )
    },
  })
}
