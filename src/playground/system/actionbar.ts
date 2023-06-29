import { readonly, ref } from 'vue'

const buttonsDiv = ref(false)

export function useActionbar() {
  const mounted = () => {
    buttonsDiv.value = true
  }

  const unMounted = () => {
    buttonsDiv.value = false
  }

  return {
    canTeleport: readonly(buttonsDiv),
    mounted,
    unMounted,
  }
}
