import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { damText, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import { type AssetFileProperties, DamAssetType } from '@/domains/dam/types/Asset'
import type { DatetimeUTCNullable } from '@/shared/types/common'
import { dateTimeFriendly } from '@/shared/utils/datetime'

// The backend sends `autoDeleteAt` to every admin.
// The badge is shown only where the application passes the date (admin-dam). admin-cms and admin-ugc show none.

const NOW = '2026-11-04T10:00:00Z'
const IN_THREE_DAYS = '2026-11-07T11:00:00Z'
const IN_TWO_HOURS = '2026-11-04T12:00:00Z'
const AN_HOUR_AGO = '2026-11-04T09:00:00Z'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const properties: AssetFileProperties = {
  distributesInServices: [],
  slotNames: [],
  fromRss: false,
  width: 0,
  height: 0,
}
const badge = () => wrapper!.find('[data-cy="asset-auto-delete-badge"]')

describe('the meta icons of an asset', () => {
  const mountIcons = (autoDeleteAt?: DatetimeUTCNullable) =>
    (wrapper = mount(AssetImageMetaIcons, {
      props: {
        assetType: DamAssetType.Image,
        assetFileProperties: properties,
        ...(autoDeleteAt === undefined ? {} : { autoDeleteAt }),
      },
      global: { plugins: [createPinia()] },
      // Attached, so that isVisible sees what v-show hides.
      attachTo: document.body,
    }))

  it('show the time left until the automatic deletion, and its date in the title, where the application passes it', () => {
    mountIcons(IN_THREE_DAYS)

    expect(badge().text()).toBe(uiText('common.time.short.remainingDays', { value: 3 }))
    expect(badge().attributes('title')).toBe(
      damText('asset.metaIcons.autoDeleteAt', { date: dateTimeFriendly(IN_THREE_DAYS) })
    )
    // A missing translation would come back as its key on both sides of the comparison above.
    expect(badge().attributes('title')).toContain(dateTimeFriendly(IN_THREE_DAYS))
  })

  it('move the time left on while the badge is shown', async () => {
    mountIcons(IN_TWO_HOURS)
    expect(badge().text()).toBe(uiText('common.time.short.remainingHours', { value: 2 }))

    vi.advanceTimersByTime(61 * 60_000)
    await nextTick()

    expect(badge().text()).toBe(uiText('common.time.short.remainingMinutes', { value: 59 }))
  })

  it('stay shown with the badge alone, when the asset has no icon', () => {
    mountIcons(IN_THREE_DAYS)

    expect(wrapper!.find('img.img-svg').exists()).toBe(false)
    expect(wrapper!.find('.asset-image__meta-icons').isVisible()).toBe(true)
  })

  it('show no time below zero once the date has passed', () => {
    mountIcons(AN_HOUR_AGO)

    expect(badge().text()).toBe(uiText('common.time.short.remainingSeconds', { value: 0 }))
  })

  it.each([
    ['where the application does not pass it, by default', undefined],
    ['for an asset DAM does not delete', null],
  ])('show no badge %s', (_what, autoDeleteAt) => {
    mountIcons(autoDeleteAt)

    expect(badge().exists()).toBe(false)
    expect(wrapper!.find('.asset-image__meta-icons').isVisible()).toBe(false)
    expect(vi.getTimerCount(), 'no clock runs without a date').toBe(0)
  })
})

describe('the image of an asset', () => {
  // The placeholder, the plain <img> (admin-dam's tiles) and the VImg each render their own meta icons.
  const SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  const branches = [
    ['without an image', {}],
    ['with an image', { src: SRC }],
    ['with an image component', { src: SRC, useComponent: true }],
  ] as const

  it.each(branches)(
    'hands its meta icons the date of the automatic deletion and the licence badge the application passes, %s',
    (_what, image) => {
      wrapper = mount(AssetImage, {
        props: {
          assetType: DamAssetType.Image,
          showMetaIcons: true,
          assetFileProperties: properties,
          autoDeleteAt: IN_THREE_DAYS,
          licenceBadge: 'FB',
          ...image,
        },
        global: { plugins: [createPinia()] },
      })

      expect(badge().exists()).toBe(true)
      expect(wrapper.find('[data-cy="asset-licence-badge"]').text(), 'and the badge of the licence').toBe('FB')
    }
  )

  it.each(branches)('leaves the badge out by default, %s', (_what, image) => {
    wrapper = mount(AssetImage, {
      props: { assetType: DamAssetType.Image, showMetaIcons: true, assetFileProperties: properties, ...image },
      global: { plugins: [createPinia()] },
    })

    expect(badge().exists()).toBe(false)
    expect(wrapper.find('[data-cy="asset-licence-badge"]').exists()).toBe(false)
  })
})
