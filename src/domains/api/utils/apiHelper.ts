import { stringUrlTemplateReplace } from '@/shared/utils/string'
import { isEmptyObject } from '@/shared/utils/common'

export type UrlParams = {
  [key: string]: number | string
}

export const replaceUrlParameters = (urlTemplate: string, urlParams: UrlParams, overrideUrlTemplate = '') => {
  if (isEmptyObject(urlParams)) return urlTemplate
  return stringUrlTemplateReplace(overrideUrlTemplate === '' ? urlTemplate : overrideUrlTemplate, urlParams)
}
