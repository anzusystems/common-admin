import { stringUrlTemplateReplace } from '@/utils/string'
import { isEmptyObject } from '@/utils/common'

export type UrlParams = {
  [key: string]: number | string
}

export const replaceUrlParameters = (urlTemplate: string, urlParams: UrlParams, overrideUrlTemplate = '') => {
  if (isEmptyObject(urlParams)) return urlTemplate
  return stringUrlTemplateReplace(overrideUrlTemplate === '' ? urlTemplate : overrideUrlTemplate, urlParams)
}
