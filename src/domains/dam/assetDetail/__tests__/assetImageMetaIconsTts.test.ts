import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { damText } from '@/domains/dam/__tests__/support/uploadUi'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import { ICON_RSS, ICON_TTS } from '@/domains/dam/assetDetail/utils/assetImageIconsConfig'
import { type AssetFileProperties, DamAssetType } from '@/domains/dam/types/Asset'

// The icon of a synthesized audio (TTS) among the meta icons of an asset. The backend says `ttsAudio` to every
// admin; the icon is shown only where the application asks for it (admin-dam), so admin-cms and admin-ugc see the
// icons they always saw.

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const properties = (parts: Partial<AssetFileProperties> = {}): AssetFileProperties => ({
  distributesInServices: [],
  slotNames: [],
  fromRss: false,
  width: 0,
  height: 0,
  ...parts,
})
const icons = () =>
  wrapper!.findAll('img.img-svg').map((icon) => [icon.attributes('src'), icon.attributes('title')] as const)
const tts = [ICON_TTS, damText('asset.metaIcons.tts')] as const

describe('the meta icons of an asset', () => {
  const mountIcons = (assetFileProperties: AssetFileProperties, showTts?: boolean) =>
    (wrapper = mount(AssetImageMetaIcons, {
      props: { assetType: DamAssetType.Audio, assetFileProperties, ...(showTts ? { showTts } : {}) },
      global: { plugins: [createPinia()] },
    }))

  it('show the icon of a synthesized audio, after that of RSS, where the application asks for it', () => {
    mountIcons(properties({ fromRss: true, ttsAudio: true }), true)

    expect(icons()).toEqual([[ICON_RSS, damText('asset.metaIcons.rss')], tts])
  })

  it.each([
    ['where the application does not ask for it, by default', { ttsAudio: true }, undefined],
    ['for an asset that is no synthesized audio', { ttsAudio: false }, true],
    ['for an asset the backend says nothing of', {}, true],
  ])('show no such icon %s', (_what, parts, showTts) => {
    mountIcons(properties(parts), showTts)

    expect(icons()).toEqual([])
  })
})

describe('the image of an asset', () => {
  it.each([
    ['hands its meta icons the icon of a synthesized audio where the application asks for it', true, [tts]],
    ['leaves it out by default', undefined, []],
  ])('%s', (_what, showTts, expected) => {
    wrapper = mount(AssetImage, {
      props: {
        assetType: DamAssetType.Audio,
        showMetaIcons: true,
        assetFileProperties: properties({ ttsAudio: true }),
        ...(showTts ? { showTts } : {}),
      },
      global: { plugins: [createPinia()] },
    })

    expect(icons()).toEqual(expected)
  })
})
