import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import { type AssetFileProperties, DamAssetType } from '@/domains/dam/types/Asset'

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
})
