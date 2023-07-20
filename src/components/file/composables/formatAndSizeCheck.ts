import { useAlerts } from '@/composables/system/alerts'
import { fileTypeFix } from '@/components/file/composables/fileType'
import { isUndefined } from '@/utils/common'
import { computed } from 'vue'
import { i18n } from '@/plugins/i18n'

/**
 * @param accept example: 'image/*,.jpg'
 * @param maxSizes example: { 'image/*': 20000 } or { 'image/png': 20000, 'image/jpg': 20000 } or
 *                          { '.jpg': 20000, '.png': 20000 } or { '*': 20000, }
 */
export function useFormatAndSizeCheck(accept: string | undefined, maxSizes: Record<string, number> | undefined) {
  const acceptKeys = computed(() => {
    if (isUndefined(accept)) {
      return []
    }
    return accept.split(',')
  })

  const maxSizeKeys = computed(() => {
    if (isUndefined(maxSizes)) {
      return []
    }
    return Object.keys(maxSizes)
  })

  const checkFormatsAndSizes = (files: File[], disableAlert = false) => {
    const incorrectFileNames: string[] = []
    const validFiles = files.filter((file) => {
      const isFileValid = checkFormats(file, acceptKeys.value) && checkSizes(file, maxSizeKeys.value, maxSizes)
      if (!isFileValid) {
        incorrectFileNames.push(file.name)
      }
      return isFileValid
    })
    if (incorrectFileNames.length && !disableAlert) {
      const { showWarning } = useAlerts()
      const { t } = i18n.global
      showWarning(t('system.upload.incorrectFormatSize') + ':' + incorrectFileNames.join(', '))
    }

    return validFiles
  }

  const checkFormats = (file: File, accepts: string[]) => {
    if (accepts.length === 0) {
      return true
    }
    for (let i = 0; i < accepts.length; i++) {
      if (accepts[i].startsWith('.')) {
        // .format
        if (file.name.toLowerCase().endsWith(accepts[i])) {
          return true
        }
      } else {
        // type
        const splitType = accepts[i].split('/')
        if (splitType[1] === '*' && fileTypeFix(file).startsWith(splitType[0] + '/')) {
          return true
        } else if (accepts[i] === fileTypeFix(file)) {
          return true
        }
      }
    }
    return false
  }

  const checkSizes = (file: File, keys: Array<string>, sizes: Record<string, number> | undefined) => {
    if (keys.length === 0 || isUndefined(sizes)) {
      return true
    }
    for (let j = 0; j < keys.length; j++) {
      if (keys[j] === '*' && sizes[keys[j]] <= file.size) {
        // *
        return true
      } else if (keys[j].startsWith('.') && sizes[keys[j]] <= file.size) {
        // .format
        return true
      } else {
        // type
        const splitType = keys[j].split('/')
        if (splitType[1] === '*' && fileTypeFix(file).startsWith(splitType[0] + '/') && sizes[keys[j]] > file.size) {
          return true
        } else if (keys[j] === fileTypeFix(file) && sizes[keys[j]] > file.size) {
          return true
        }
      }
    }
    return false
  }

  return {
    checkFormatsAndSizes,
  }
}
