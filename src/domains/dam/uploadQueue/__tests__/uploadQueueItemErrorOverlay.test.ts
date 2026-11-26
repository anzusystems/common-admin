import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import UploadQueueItemErrorOverlay from '@/domains/dam/uploadQueue/components/UploadQueueItemErrorOverlay.vue'
import libraryStyle from '@/styles/main.scss?inline'

// The text of a failed row sits on a tile of its own and wraps inside it. In the single-upload dialog it ran
// across the placeholder icon below it, as if it spilled out of a tile of the icon's width.

const LONG = 'Systémová chyba. Skúste neskôr alebo kontaktujte administrátora.'

let wrapper: VueWrapper | undefined
let host: HTMLElement | undefined
let style: HTMLStyleElement
beforeEach(() => {
  style = document.createElement('style')
  style.textContent = libraryStyle
  document.head.append(style)
})
afterEach(() => {
  wrapper?.unmount()
  host?.remove()
  style.remove()
})

const shown = (width: number, height: number, message: string) => {
  host = document.createElement('div')
  host.style.cssText = `position: relative; width: ${width}px; height: ${height}px;`
  document.body.append(host)
  wrapper = mount(UploadQueueItemErrorOverlay, {
    attachTo: host,
    props: { error: { hasError: true, message, assetFileFailReason: AssetFileFailReason.None } },
  })
  const box = host.getBoundingClientRect()
  const tile = host.querySelector('.dam-upload-queue__error-tile')!.getBoundingClientRect()
  const text = host.querySelector('.dam-upload-queue__error-tile .text-body-small')!.getBoundingClientRect()
  return { box, tile, text }
}

describe('the error of a failed upload row', () => {
  it('wraps a long text inside its tile, over a large picture', () => {
    const { box, tile, text } = shown(1300, 1000, LONG)

    expect(text.left).toBeGreaterThanOrEqual(tile.left)
    expect(text.right).toBeLessThanOrEqual(tile.right)
    expect(text.height).toBeGreaterThan(20)
    expect(tile.width).toBeLessThan(box.width / 2)
    expect(Math.abs(tile.left + tile.width / 2 - (box.left + box.width / 2))).toBeLessThan(1)
  })

  it('keeps its tile inside a narrow card', () => {
    const { box, tile, text } = shown(170, 96, LONG)

    expect(tile.left).toBeGreaterThanOrEqual(box.left)
    expect(tile.right).toBeLessThanOrEqual(box.right)
    expect(text.right).toBeLessThanOrEqual(tile.right)
  })
})
