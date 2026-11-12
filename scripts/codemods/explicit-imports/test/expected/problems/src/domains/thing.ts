import { useStore } from '@/shared/store'

export const thingLabel = 'thing'
export const describe = () => useStore().label
