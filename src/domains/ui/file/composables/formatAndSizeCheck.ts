import { useAlerts } from '@/domains/system/composables/alerts'
import { damFileTypeFix } from '@/domains/ui/file/utils/fileType'
import { isUndefined } from '@/shared/utils/common'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { commonT } from '@/plugins/i18n'

/**
 * @param accept example: 'image/*,.jpg'
 * @param maxSizes example: { 'image/*': 20000 } or { 'image/png': 20000, 'image/jpg': 20000 } or
 *                          { '.jpg': 20000, '.png': 20000 } or { '*': 20000, }
 */
export function useFormatAndSizeCheck(
  acceptSource: MaybeRefOrGetter<string | undefined>,
  maxSizesSource: MaybeRefOrGetter<Record<string, number> | undefined>
) {
  const acceptKeys = computed(() => {
    const accept = toValue(acceptSource)
    if (isUndefined(accept)) {
      return []
    }
    return accept.split(',')
  })

  const maxSizeKeys = computed(() => {
    const maxSizes = toValue(maxSizesSource)
    if (isUndefined(maxSizes)) {
      return []
    }
    return Object.keys(maxSizes)
  })

  const checkFormatsAndSizes = (files: File[], disableAlert = false) => {
    const incorrectFileNames: string[] = []
    const validFiles = files.filter((file) => {
      const isFileValid =
        checkFormats(file, acceptKeys.value) && checkSizes(file, maxSizeKeys.value, toValue(maxSizesSource))
      if (!isFileValid) {
        incorrectFileNames.push(file.name)
      }
      return isFileValid
    })
    if (incorrectFileNames.length && !disableAlert) {
      const { showWarning } = useAlerts()
      const t = commonT
      showWarning(t('common.system.upload.incorrectFormatSize') + ':' + incorrectFileNames.join(', '))
    }

    return validFiles
  }

  const checkFormats = (file: File, accepts: string[]) => {
    if (accepts.length === 0) {
      return true
    }
    for (const accept of accepts) {
      if (accept.startsWith('.')) {
        // .format
        if (file.name.toLowerCase().endsWith(accept)) {
          return true
        }
      } else {
        // type
        const splitType = accept.split('/')
        if (splitType[1] === '*' && damFileTypeFix(file).startsWith(splitType[0] + '/')) {
          return true
        } else if (accept === damFileTypeFix(file)) {
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
    // A file exactly at the limit passes, as in the dam's own check: the limit is the largest size allowed.
    // `keys` are `Object.keys` of these same sizes.
    for (const key of keys) {
      if (key === '*') {
        if (sizes[key]! >= file.size) return true
      } else if (key.startsWith('.')) {
        if (file.name.toLowerCase().endsWith(key) && sizes[key]! >= file.size) return true
      } else {
        // type
        const splitType = key.split('/')
        if (splitType[1] === '*' && damFileTypeFix(file).startsWith(splitType[0] + '/') && sizes[key]! >= file.size) {
          return true
        } else if (key === damFileTypeFix(file) && sizes[key]! >= file.size) {
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
