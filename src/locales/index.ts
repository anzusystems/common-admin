import { setValueByPath } from '../utils/object'

// note: now import is not dynamic, so all language files are loaded at once
const modules = import.meta.glob('./(sk|en)/**/*.yaml', { eager: true })

const cleanupKey = (key: string) => {
  key = key.substring(2)
  return key.substring(0, key.indexOf('.'))
}

const final = {}
for (const key in modules) {
  const path = cleanupKey(key)
  // @ts-ignore
  setValueByPath(final, path, modules[key].default, '/')
}

export const commonMessages = final
