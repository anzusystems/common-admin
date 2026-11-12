<script lang="ts" setup>
import { ref, watch } from 'vue'
import { type RouteLocationRaw } from 'vue-router'
import type { VBtn } from 'vuetify/components'

withDefaults(
  defineProps<{
    from: RouteLocationRaw
    to: RouteLocationRaw
  }>(),
  {}
)

// const router = useRouter()

const times = ref(10)
const running = ref(false)
const timeBetweenClicksFirst = 500
const timeBetweenClicksSecond = 500
const numRepeats = ref(10)

const buttonList = ref<InstanceType<typeof VBtn> | null>(null)
const buttonEdit = ref<InstanceType<typeof VBtn> | null>(null)

const onClick = () => {
  running.value = true
  // router.push({ name: ROUTE.SYSTEM.DASHBOARD })
  setTimeout(clickFirstElement, timeBetweenClicksFirst)
}

function clickFirstElement() {
  if (!buttonList.value) return
  buttonList.value.$el.click()
  setTimeout(clickSecondElement, timeBetweenClicksFirst)
}

function reset() {
  numRepeats.value = times.value
  running.value = false
}

function clickSecondElement() {
  if (!buttonEdit.value) return
  buttonEdit.value.$el.click()

  if (numRepeats.value > 0) {
    numRepeats.value--
    setTimeout(clickFirstElement, timeBetweenClicksSecond)
  } else {
    buttonList.value?.$el.click()
    reset()
  }
}

watch(
  times,
  (newValue) => {
    numRepeats.value = newValue
  },
  { immediate: true }
)
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VBtn
        ref="buttonList"
        block
        :to="from"
      >
        View 1
      </VBtn>
    </VCol>
    <VCol cols="12">
      <VBtn
        ref="buttonEdit"
        block
        :to="to"
      >
        View 2
      </VBtn>
    </VCol>
    <VCol cols="12">
      <span v-if="running">remaining: {{ numRepeats }}</span>
    </VCol>
    <VCol cols="12">
      <VTextField
        v-model.number="times"
        :disabled="running"
        label="repeat times"
        type="number"
      />
    </VCol>
    <VCol cols="12">
      <VBtn
        block
        :disabled="running"
        @click.stop="onClick"
      >
        run test
      </VBtn>
    </VCol>
  </VRow>
</template>
