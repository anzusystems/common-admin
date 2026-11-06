import { ref as vueRef, watch } from 'vue'
import type { Ref } from 'vue'

export const a: Ref<number> = vueRef(1)
export const b = ref(2)
export const c: ComputedRef<number> = computed(() => a.value)
watch(a, () => {})
