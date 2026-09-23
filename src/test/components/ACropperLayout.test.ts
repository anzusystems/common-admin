import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ACropper from '@/components/damImage/uploadQueue/cropper/ACropper.vue'
import { mountCropper, V2_ADAPTER, wait } from '@/test/support/cropperHarness'
import { LANDSCAPE_IMAGE, PORTRAIT_IMAGE } from '@/test/fixtures/cropperImages'

/**
 * How the cropper answers the room it is given.
 *
 * The frame a cropper sits in changes for reasons that have nothing to do with its own width: a
 * shorter window against a `vh` limit, a panel animating open, a tab becoming visible. Each of those
 * used to leave the picture sized for a frame that no longer exists — and a picture larger than its
 * frame hides part of the crop where it cannot be dragged back.
 */

const AR_16_9 = 16 / 9
const SETTLE = 400

/** The crop as fractions of the picture, read off the page. */
const cropOf = (root: HTMLElement) => {
  const picture = root.querySelector('cropper-image')!.getBoundingClientRect()
  const box = root.querySelector('cropper-selection')!.getBoundingClientRect()
  return {
    x: (box.left - picture.left) / picture.width,
    y: (box.top - picture.top) / picture.height,
    width: box.width / picture.width,
    height: box.height / picture.height,
  }
}

describe('ACropper layout', () => {
  // The DAM sizes the cropper with `calc(100vh - 160px)`: a shorter window changes the height it may
  // use without touching its width.
  it('re-fits when only the height it is allowed changes', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 520,
      props: { aspectRatio: 1, containerStyle: { overflow: 'hidden', maxHeight: '500px' } },
    })
    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(501)

    await cropper.wrapper.setProps({ containerStyle: { overflow: 'hidden', maxHeight: '250px' } })
    await wait(SETTLE)

    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(251)
    expect(cropper.api.displaySize().height).toBeGreaterThan(200)
    cropper.destroy()
  })

  it('keeps the crop it was showing across a height-only change', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 520,
      props: { aspectRatio: 1, containerStyle: { overflow: 'hidden', maxHeight: '500px' } },
    })
    await cropper.api.setData({ x: 100, y: 150, width: 300, height: 300 })
    await wait(100)

    await cropper.wrapper.setProps({ containerStyle: { overflow: 'hidden', maxHeight: '250px' } })
    await wait(SETTLE)

    const data = cropper.api.getData()
    expect(data.x).toBeCloseTo(100, -1)
    expect(data.y).toBeCloseTo(150, -1)
    expect(data.width).toBeCloseTo(300, -1)
    cropper.destroy()
  })

  // An ancestor that clips can show less of the host without the host's own box moving at all, so
  // watching the host alone hears nothing.
  it('re-fits when a clipping ancestor gets shorter', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; height: 500px; overflow: hidden;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 520,
      parent: frame,
    })
    await wait(SETTLE)
    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(501)

    frame.style.height = '240px'
    await wait(SETTLE)

    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(241)
    cropper.destroy()
    frame.remove()
  })

  // Content above a clipping ancestor's top is hidden just as surely as content below its bottom.
  it('counts the part of itself hidden above a clipping ancestor', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; height: 300px; overflow: hidden; position: relative;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 520,
      parent: frame,
    })
    cropper.host.style.cssText = 'width: 520px; position: relative; top: -100px;'
    await wait(SETTLE)
    // Nudge it so the observer has something to react to.
    cropper.host.style.width = '519px'
    await wait(SETTLE)

    // Only 300px of the frame is ever visible; a 400px picture would leave 100px of it unreachable.
    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(301)
    cropper.destroy()
    frame.remove()
  })

  // Mounted inside a closed panel or an unselected tab there is nothing to measure, and the region a
  // host applies in its `ready` callback has nowhere to go until the panel opens.
  it('applies a crop asked for while it had no layout, once it gets one', async () => {
    const wrapper1 = document.createElement('div')
    wrapper1.style.cssText = 'width: 640px; display: none;'
    document.body.appendChild(wrapper1)

    let readyCalls = 0
    const wrapper = mount(ACropper, {
      attachTo: wrapper1,
      props: {
        src: LANDSCAPE_IMAGE.src,
        aspectRatio: AR_16_9,
        // The region a host binds while its panel is still closed.
        modelValue: { x: 0.1, y: 0.1, width: 0.6, height: 0.45 },
        onReady: () => {
          readyCalls += 1
        },
      },
    })

    await wait(600)
    expect(readyCalls).toBe(1)

    wrapper1.style.display = 'block'
    await wait(SETTLE)

    const crop = cropOf(wrapper1)
    expect(crop.x).toBeCloseTo(0.1, 2)
    expect(crop.y).toBeCloseTo(0.1, 2)
    expect(crop.width).toBeCloseTo(0.6, 2)

    wrapper.unmount()
    wrapper1.remove()
  })

  it('falls back to the default crop when it is shown without one having been asked for', async () => {
    const wrapper1 = document.createElement('div')
    wrapper1.style.cssText = 'width: 640px; display: none;'
    document.body.appendChild(wrapper1)

    const wrapper = mount(ACropper, {
      attachTo: wrapper1,
      props: { src: LANDSCAPE_IMAGE.src, aspectRatio: AR_16_9 },
    })

    await wait(600)
    wrapper1.style.display = 'block'
    await wait(SETTLE)

    // The 80% box the cropper would have started with had it been visible all along.
    const crop = cropOf(wrapper1)
    expect(crop.width).toBeCloseTo(0.8, 2)
    expect(crop.x).toBeCloseTo(0.1, 2)

    wrapper.unmount()
    wrapper1.remove()
  })

  // A width seen while the cropper was still loading must not be mistaken for one it laid out for.
  it('still reacts to a width it saw while the image was loading', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 640 })

    cropper.wrapper.setProps({ src: PORTRAIT_IMAGE.src })
    cropper.host.style.width = '420px'
    await wait(600)
    cropper.host.style.width = '640px'
    await wait(SETTLE)

    expect(cropper.api.displaySize().width).toBeCloseTo(600, 0)
    cropper.destroy()
  })

  // A disabled cropper still has to follow its frame: `DamAssetImageRoiSelect` disables it while it
  // pushes a stored region in, and a layout that settles in that window must not be missed.
})
