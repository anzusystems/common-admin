<script lang="ts" setup>
import type { IntegerIdNullable } from '@/shared/types/common'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import { COMMON_CONFIG } from '@/shared/commonConfig'
import AAnzuUserAvatar from '@/domains/ui/components/AAnzuUserAvatar.vue'
import { replaceUrlParameters } from '@/domains/api/utils/apiHelper'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'

const props = withDefaults(
  defineProps<{
    id: IntegerIdNullable | undefined
    /** The admin's cache getter, e.g. `getCachedUser` of its `useCachedUsers()`. */
    getCachedFn: (id: IntegerIdNullable | undefined) => CachedItem<AnzuUserMinimal> | undefined
    routeName?: string | undefined
    externalUrlTemplate?: string | undefined
    /**
     * The label, for a cache whose users carry a better one than `person.fullName` (a nickname). `any`,
     * because it reads the admin's own user, which `AnzuUserMinimal` does not describe.
     */
    titleFn?: ((user: CachedItem<any>) => string) | undefined
    disableClick?: boolean
  }>(),
  {
    routeName: undefined,
    externalUrlTemplate: undefined,
    titleFn: undefined,
    disableClick: false,
  }
)

const { t } = useI18n()
const router = useRouter()
// 0 counts as no id, as it does in `defineCached`: a blank factory record carries it.
const { cached, loaded, unresolved } = useCachedItem(() => (props.id ? props.getCachedFn(props.id) : undefined))

// Optional chaining on purpose: each admin maps its own users into the cache, and a mapper that
// leaves the name or the e-mail out falls through to the next label instead of throwing.
const text = computed(() => {
  const user = cached.value
  if (!user) return ''
  const title = props.titleFn ? props.titleFn(user) : ''
  if (title) return title
  if (user.person?.fullName) return user.person.fullName
  if (user.email) return user.email.split('@')[0]
  return '#' + props.id
})

const clickable = computed(
  () => !props.disableClick && !unresolved.value && !!(props.externalUrlTemplate || props.routeName)
)

const appendIcon = computed(() => {
  if (!clickable.value) return undefined
  return props.externalUrlTemplate ? COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL : COMMON_CONFIG.CHIP.ICON.LINK
})

const onClick = () => {
  if (!clickable.value || !props.id) return
  if (props.externalUrlTemplate) {
    window.open(replaceUrlParameters(props.externalUrlTemplate, { id: props.id }), '_blank')
    return
  }
  if (props.routeName) router.push({ name: props.routeName, params: { id: props.id } })
}
</script>

<template>
  <div class="d-inline-flex">
    <span v-if="!id">-</span>
    <VChip
      v-else-if="unresolved"
      class="non-clickable"
      size="small"
      data-cy="cached-user-chip-unresolved"
    >
      #{{ id }}
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t('common.model.tracking.userUnavailable') }}
      </VTooltip>
    </VChip>
    <VChip
      v-else
      class="pl-1"
      :class="clickable ? '' : 'non-clickable'"
      size="small"
      :append-icon="appendIcon"
      @click.stop="onClick"
    >
      <AAnzuUserAvatar
        v-if="loaded"
        :user="cached"
        container-class="mr-1"
        :size="20"
      />
      {{ text }}
      <VProgressCircular
        v-if="!loaded"
        :size="12"
        :width="2"
        indeterminate
        class="ml-1"
      />
    </VChip>
  </div>
</template>

<style lang="scss" scoped>
.non-clickable {
  cursor: default;
}
</style>
