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

const sourceBadges = [
  { id: 'ap', name: 'AP', badge: 'AP' },
  { id: 'tasr', name: 'TASR', badge: 'TASR' },
]

const mountIcons = (props: Record<string, unknown>) =>
  mount(AssetImageMetaIcons, {
    props: { assetType: DamAssetType.Image, assetFileProperties: fileProperties, ...props },
  })

describe('AssetImageMetaIcons source badges', () => {
  it('shows the badges in the given order and names the source', () => {
    const badges = mountIcons({ sourceBadges }).findAll('[data-cy="asset-source-badge"]')

    expect(badges.map((badge) => badge.text())).toEqual(['AP', 'TASR'])
    expect(badges[0].attributes('title')).toContain('AP')
  })

  it('shows the licence badge before the source badges', () => {
    const badges = mountIcons({ sourceBadges, licenceBadge: 'TASR' }).findAll('.asset-image__licence-badge')

    expect(badges.map((badge) => badge.text())).toEqual(['TASR', 'AP', 'TASR'])
    expect(badges[0].attributes('data-cy')).toBe('asset-licence-badge')
  })

  it('hides the row without badges and icons', () => {
    expect(mountIcons({}).find('.asset-image__meta-icons').attributes('style')).toContain('display: none')
    expect(mountIcons({ sourceBadges }).find('.asset-image__meta-icons').attributes('style')).toBeUndefined()
  })
})
