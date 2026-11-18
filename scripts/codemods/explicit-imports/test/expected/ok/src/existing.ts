import { ref as vueRef, watch, ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export const a: Ref<number> = vueRef(1)
export const b = ref(2)
export const c: ComputedRef<number> = computed(() => a.value)
watch(a, () => {})
