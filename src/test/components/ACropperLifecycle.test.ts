import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ACropper from '@/components/damImage/uploadQueue/cropper/ACropper.vue'
import { mountCropper, nextFrame, V2_ADAPTER, wait } from '@/test/support/cropperHarness'
import { LANDSCAPE_IMAGE, PORTRAIT_IMAGE, SMALL_IMAGE, WIDE_IMAGE } from '@/test/fixtures/cropperImages'

/**
 * How `ACropper` copes with its inputs changing underneath it, and with being torn down.
 *
 * `ACropperjs` never reacted to a new `src` at all — hosts worked around that by keying the
 * component so Vue would throw the old one away (`DamAssetImageRoiSelect` still does). `ACropper`
 * rebuilds itself instead, so these are the cases that keying used to hide.
 */

const AR_16_9 = 16 / 9

const waitForCalls = async (count: () => number, expected: number, timeout = 5000) => {
  const deadline = Date.now() + timeout
  while (count() < expected) {
    if (Date.now() > deadline) throw new Error(`waited for ${expected} calls, saw ${count()}`)
    await wait(30)
  }
}

describe('ACropper lifecycle', () => {
  it('rebuilds itself when the source changes', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, fixture: LANDSCAPE_IMAGE })
    const landscape = cropper.api.displaySize()
    expect(landscape.width / landscape.height).toBeCloseTo(
      LANDSCAPE_IMAGE.naturalWidth / LANDSCAPE_IMAGE.naturalHeight,
      2
    )

    await cropper.wrapper.setProps({ src: PORTRAIT_IMAGE.src })
    await waitForCalls(cropper.readyCalls, 2)
    await nextFrame()

    const portrait = cropper.api.displaySize()
    expect(portrait.width / portrait.height).toBeCloseTo(PORTRAIT_IMAGE.naturalWidth / PORTRAIT_IMAGE.naturalHeight, 2)
    cropper.destroy()
  })

  it('reports itself ready again for the new source', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    await cropper.wrapper.setProps({ src: WIDE_IMAGE.src })
    await waitForCalls(cropper.readyCalls, 2)
    expect(cropper.readyCalls()).toBe(2)
    cropper.destroy()
  })

  it('starts the new source off with its own default crop', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { aspectRatio: AR_16_9 } })
    await cropper.wrapper.setProps({ src: SMALL_IMAGE.src })
    await waitForCalls(cropper.readyCalls, 2)
    await nextFrame()

    // Measured as fractions: the default box is a tenth in from the side whatever the picture is,
    // and the harness's pixel conversion still knows only the file it was mounted with.
    const crop = cropper.api.getCrop()
    expect(crop.x).toBeCloseTo(0.1, 2)
    expect(crop.y).toBeCloseTo(0.2, 2)
    expect(crop.width).toBeCloseTo(0.8, 2)
    cropper.destroy()
  })

  it('leaves exactly one cropper behind when the source changes twice in a row', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    cropper.wrapper.setProps({ src: PORTRAIT_IMAGE.src })
    await cropper.wrapper.setProps({ src: WIDE_IMAGE.src })
    await waitForCalls(cropper.readyCalls, 2)
    await wait(200)

    expect(cropper.host.querySelectorAll('cropper-canvas').length).toBe(1)
    const shown = cropper.api.displaySize()
    expect(shown.width / shown.height).toBeCloseTo(WIDE_IMAGE.naturalWidth / WIDE_IMAGE.naturalHeight, 2)
    cropper.destroy()
  })

  it('re-fits the crop when the aspect ratio changes', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { aspectRatio: AR_16_9 } })
    await cropper.wrapper.setProps({ aspectRatio: 1 })
    await nextFrame()
    await wait(100)

    const data = cropper.api.getData()
    expect(data.width / data.height).toBeCloseTo(1, 1)
    expect(data.x).toBeGreaterThanOrEqual(-1)
    expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
    cropper.destroy()
  })

  // A prop changed in the same tick as `src` reaches a component that is mid-rebuild, where the
  // watchers have no elements to write to yet. The rebuild has to finish with the current values.
  it('honours an aspect ratio changed in the same breath as the source', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { aspectRatio: AR_16_9 } })
    await cropper.wrapper.setProps({ src: WIDE_IMAGE.src, aspectRatio: 1 })
    await waitForCalls(cropper.readyCalls, 2)
    await wait(150)

    const data = cropper.api.getData()
    expect(data.width / data.height).toBeCloseTo(1, 1)
    cropper.destroy()
  })

  it('honours a shade colour changed in the same breath as the source', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    await cropper.wrapper.setProps({ src: WIDE_IMAGE.src, shadeColor: 'rgba(241, 244, 246, 0.5)' })
    await waitForCalls(cropper.readyCalls, 2)
    await wait(100)

    const shade = cropper.find('cropper-shade')
    expect(getComputedStyle(shade).getPropertyValue('--theme-color').replace(/\s+/g, '')).toBe('rgba(241,244,246,0.5)')
    cropper.destroy()
  })

  it('shows no spinner when there is no source to load', async () => {
    const host = document.createElement('div')
    host.style.width = '640px'
    document.body.appendChild(host)
    const wrapper = mount(ACropper, { attachTo: host, props: { src: '' } })
    await wait(200)
    expect(host.querySelector('.v-progress-circular')).toBeNull()
    wrapper.unmount()
    host.remove()
  })

  it('clears the spinner when the source is taken away', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    await cropper.wrapper.setProps({ src: '' })
    await wait(200)
    expect(cropper.host.querySelector('.v-progress-circular')).toBeNull()
    expect(cropper.host.querySelector('cropper-canvas')).toBeNull()
    cropper.destroy()
  })

  it('gives up quietly on a source that cannot be loaded', async () => {
    const ready = vi.fn()
    const host = document.createElement('div')
    host.style.width = '640px'
    document.body.appendChild(host)
    const wrapper = mount(ACropper, {
      attachTo: host,
      props: { src: 'data:image/png;base64,not-an-image', checkCrossOrigin: false, ready },
    })

    await wait(500)
    expect(ready).not.toHaveBeenCalled()
    // The spinner clears rather than sitting there for ever.
    expect(host.querySelector('.v-progress-circular')).toBeNull()
    expect(host.querySelector('cropper-canvas')).toBeNull()

    wrapper.unmount()
    host.remove()
  })

  it('renders nothing at all without a source', async () => {
    const host = document.createElement('div')
    host.style.width = '640px'
    document.body.appendChild(host)
    const wrapper = mount(ACropper, { attachTo: host, props: { src: '' } })
    await wait(200)
    expect(host.querySelector('cropper-canvas')).toBeNull()
    wrapper.unmount()
    host.remove()
  })

  it('is harmless without a source', async () => {
    const host = document.createElement('div')
    host.style.width = '640px'
    document.body.appendChild(host)
    const wrapper = mount(ACropper, { attachTo: host, props: { src: '' } })
    await wait(200)
    expect(host.querySelector('cropper-canvas')).toBeNull()
    expect(host.querySelector('.v-progress-circular')).toBeNull()
    expect(() => wrapper.unmount()).not.toThrow()
    host.remove()
  })

  it('applies a new shade colour without rebuilding', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { shadeColor: 'rgba(0, 0, 0, 0.5)' } })
    await cropper.wrapper.setProps({ shadeColor: 'rgba(241, 244, 246, 0.5)' })
    await nextFrame()
    const shade = cropper.find('cropper-shade')
    expect(getComputedStyle(shade).getPropertyValue('--theme-color').replace(/\s+/g, '')).toBe('rgba(241,244,246,0.5)')
    expect(cropper.readyCalls()).toBe(1)
    cropper.destroy()
  })

  // cropper.js v1 answered this one differently: it clamped the size and then fell back to the crop
  // box's *previous* position, discarding the one it was handed. Keeping the requested position is
  // the more predictable of the two, and nothing in the admin asks for a crop bigger than the image.
  it('honours the position it was given when the crop asked for is larger than the image', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { aspectRatio: AR_16_9 } })
    await cropper.api.setData({ x: 200, y: 200, width: 320, height: 180 })
    await nextFrame()
    await cropper.api.setData({ x: -500, y: -500, width: 4000, height: 2250 })
    await nextFrame()

    const data = cropper.api.getData()
    expect(data.x).toBeCloseTo(0, 0)
    expect(data.y).toBeCloseTo(0, 0)
    expect(data.width).toBeCloseTo(LANDSCAPE_IMAGE.naturalWidth, 0)
    expect(data.width / data.height).toBeCloseTo(AR_16_9, 2)
    cropper.destroy()
  })
})
