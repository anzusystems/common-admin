import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import { type AssetFileProperties, DamAssetType } from '@/domains/dam/types/Asset'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'

const fileProperties: AssetFileProperties = {
  distributesInServices: [],
  slotNames: [],
  fromRss: false,
  width: 0,
  height: 0,
}

const mountIcons = (props: Record<string, unknown>) =>
  mount(AssetImageMetaIcons, {
    props: { assetType: DamAssetType.Image, assetFileProperties: fileProperties, ...props },
  })

const badgeOf = (wrapper: ReturnType<typeof mountIcons>) => wrapper.find('[data-cy="asset-single-use-badge"]')

describe('AssetImageMetaIcons single use badge', () => {
  it('shows no badge for a photo that is not single use', () => {
    expect(badgeOf(mountIcons({ singleUse: false })).exists()).toBe(false)
  })

  it('shows a neutral 1× badge when no other record uses the photo', () => {
    const badge = badgeOf(mountIcons({ singleUse: true }))

    expect(badge.text()).toBe('1×')
    expect(badge.classes()).not.toContain('asset-image__single-use-badge--shared')
    expect(badge.find('.mdi-alert').exists()).toBe(false)
  })

  it('adds a warning icon, not only a colour, and names the usage count when the photo is shared', () => {
    const badge = badgeOf(mountIcons({ singleUse: true, singleUseUsageCount: 2 }))

    expect(badge.classes()).toContain('asset-image__single-use-badge--shared')
    expect(badge.find('.mdi-alert').exists()).toBe(true)
    expect(badge.attributes('aria-label')).toContain('2')
  })

  // admin-dam's asset list shows the badge on video, audio and documents too. It said "Single use image" there.
  it.each([DamAssetType.Image, DamAssetType.Video, DamAssetType.Audio, DamAssetType.Document])(
    'names the single use, not an image, on a %s',
    (assetType) => {
      expect(badgeOf(mountIcons({ assetType, singleUse: true })).attributes('title')).toBe('Single use')
      expect(badgeOf(mountIcons({ assetType, singleUse: true, singleUseUsageCount: 3 })).attributes('title')).toBe(
        'Single use, number of usages: 3'
      )
    }
  )

  it.each([
    ['sk', sk],
    ['en', en],
    ['cs', cs],
  ])('names no image in the badge texts in %s', (locale, messages) => {
    const { t } = createI18n({ legacy: false, locale, messages: { [locale]: messages } }).global
    const texts = [
      t('common.damImage.asset.metaIcons.singleUse'),
      t('common.damImage.asset.metaIcons.singleUseUsages', { count: 3 }),
    ]

    expect(texts.every((text) => text.length > 0 && !text.startsWith('common.'))).toBe(true)
    expect(texts.join(' ')).not.toMatch(/obráz|image/i)
  })
})
