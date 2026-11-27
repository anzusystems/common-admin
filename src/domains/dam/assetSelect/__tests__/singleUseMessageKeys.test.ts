import { describe, expect, it } from 'vitest'
import type { ComposerTranslation } from 'vue-i18n'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { AssetSingleUseUsageStatus } from '@/domains/dam/types/Asset'
import { resolveImageSaveErrorMessage } from '@/domains/dam/imageWidget/composables/imageSaveErrors'
import {
  ImageSaveErrorCode,
  type ImageSaveErrorInfo,
  ImageSaveErrorReason,
} from '@/domains/dam/imageWidget/composables/imageApiCms'

// The single use texts are built from a status or a reason (`common.assetSelect.usage.status.${status}`,
// `${key}UnknownHolder`), which `i18nLiteralKeys` does not see. A missing one shows the user the key itself.

const LOCALES = { sk, en, cs }

const lookup = (messages: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as any)[part] : undefined), messages)

const missingIn = (key: string) =>
  Object.entries(LOCALES)
    .filter(([, messages]) => !lookup(messages, key))
    .map(([locale]) => `${locale} ${key}`)

describe('the single use texts built from a value', () => {
  it('name every usage status core-cms answers, in sk, en and cs', () => {
    const missing = Object.values(AssetSingleUseUsageStatus).flatMap((status) =>
      missingIn(`common.assetSelect.usage.status.${status}`)
    )

    expect(missing).toEqual([])
  })

  it('name every refusal of an image save, with and without its photo and holder, in sk, en and cs', () => {
    const keys = new Set<string>()
    const t = ((key: string) => {
      keys.add(key)
      return key
    }) as unknown as ComposerTranslation
    const reasons = [undefined, ...Object.values(ImageSaveErrorReason)]
    for (const code of Object.values(ImageSaveErrorCode)) {
      for (const reason of reasons) {
        for (const damId of [undefined, 'f0']) {
          for (const holderResourceName of [undefined, 'gallery']) {
            const info: ImageSaveErrorInfo = { code, reason, damId, holderResourceName }
            resolveImageSaveErrorMessage(info, t)
          }
        }
      }
    }

    expect(keys.size).toBeGreaterThan(10)
    expect([...keys].flatMap(missingIn)).toEqual([])
  })
})
