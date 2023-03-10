<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    routeName: string
    recordId: number | string
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
  }>(),
  {
    buttonT: 'common.button.edit',
    buttonClass: 'ml-2',
    dataCy: 'button-edit',
    loading: false,
  }
)
const emit = defineEmits<{
  (e: 'editRecord'): void
}>()

const { t } = useI18n()

const router = useRouter()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('editRecord')
  router.push({ name: props.routeName, params: { id: props.recordId } })
}
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :loading="loading"
    color="primary"
    rounded="pill"
    @click.stop="onClick"
  >
    <span>{{ t(buttonT) }}</span>
  </VBtn>
</template>
