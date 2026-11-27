import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import ACropper from '@/domains/dam/cropper/components/ACropper.vue'
import { mountCropper, V2_ADAPTER, wait } from '@/domains/dam/cropper/__tests__/support/cropperHarness'
import {
  type CropperFixture,
  LANDSCAPE_IMAGE,
  PORTRAIT_IMAGE,
  SMALL_IMAGE,
} from '@/domains/dam/cropper/__tests__/support/cropperImages'

/**
 * How the cropper reacts to the room it is given.
 * Its frame changes for reasons unrelated to its width: a shorter window against a `vh` limit, a panel animating open,
 * a tab becoming visible. A picture larger than its frame hides part of the crop where it cannot be dragged back.
 */

const AR_16_9 = 16 / 9
const SETTLE = 400

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
  // The DAM sizes the cropper with `calc(100vh - 160px)`. A shorter
  // window changes the allowed height without changing the width.
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

  // A clipping ancestor can show less of the host without the
  // host's own box changing, so observing the host alone misses it.
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

  // The host is as tall as its canvas, so its own box cannot show that the frame grew back.
  it('grows back when a clipping ancestor gets taller again', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; height: 500px; overflow: hidden;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 520,
      parent: frame,
    })
    frame.style.height = '240px'
    await wait(SETTLE)
    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(241)

    frame.style.height = '500px'
    await wait(SETTLE)

    expect(cropper.api.displaySize().height).toBeGreaterThan(490)
    cropper.destroy()
    frame.remove()
  })

  // The asset detail's picture panel animates its height when a wider window takes it past a breakpoint (#87746).
  // The width changes at once, and the cropper was laid out for the panel's first, short frame.
  it('ends at the full size when its frame grows in a transition after the width changed', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; height: 240px; overflow: hidden; transition: height 0.2s;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      fixture: PORTRAIT_IMAGE,
      hostWidth: 400,
      parent: frame,
    })
    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(241)

    cropper.host.style.width = '520px'
    frame.style.height = '500px'
    await wait(600)

    expect(cropper.api.displaySize().height).toBeGreaterThan(490)
    cropper.destroy()
    frame.remove()
  })

  // The DAM's limit `calc(100vh - 160px)` rises with a taller window, and nothing the cropper observes changes size.
  it('grows back when a taller window raises its own height limit', async () => {
    await page.viewport(414, 500)
    try {
      const cropper = await mountCropper({
        adapter: V2_ADAPTER,
        fixture: PORTRAIT_IMAGE,
        hostWidth: 380,
        props: { aspectRatio: 1, containerStyle: { overflow: 'hidden', maxHeight: 'calc(100vh - 160px)' } },
      })
      expect(cropper.api.displaySize().height).toBeLessThanOrEqual(341)

      await page.viewport(414, 896)
      await wait(SETTLE)

      // 380 px wide, so the picture wants 507 px of the 736 px allowed.
      expect(cropper.api.displaySize().height).toBeGreaterThan(500)
      cropper.destroy()
    } finally {
      await page.viewport(414, 896)
    }
  })

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

    expect(cropper.api.displaySize().height).toBeLessThanOrEqual(301)
    cropper.destroy()
    frame.remove()
  })

  // Mounted in a closed panel or an unselected tab, there is nothing to measure.
  // A region a host applies in its `ready` callback has nowhere to go until the panel opens.
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

    const crop = cropOf(wrapper1)
    expect(crop.width).toBeCloseTo(0.8, 2)
    expect(crop.x).toBeCloseTo(0.1, 2)

    wrapper.unmount()
    wrapper1.remove()
  })

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

  // The asset detail dialog centres the editor in a flex row. A shrink-wrapped cropper had
  // no width to measure, and every picture came out at the 200px minimum.
  describe('centred in a flex row, as in the asset detail dialog', () => {
    const mountInRow = async (fixture: CropperFixture, rowWidth: number) => {
      const frame = document.createElement('div')
      document.body.appendChild(frame)
      let onReady = () => {}
      const ready = new Promise<void>((resolve) => {
        onReady = resolve
      })
      const wrapper = mount(
        defineComponent({
          setup: () => () =>
            h(
              'div',
              {
                class: 'row',
                style: `display: flex; align-items: center; justify-content: center; width: ${rowWidth}px; height: 700px;`,
              },
              [h(ACropper, { src: fixture.src, aspectRatio: 3 / 2, onReady })]
            ),
        }),
        { attachTo: frame }
      )
      await ready
      await wait(SETTLE)
      const row = frame.querySelector('.row')!.getBoundingClientRect()
      const picture = frame.querySelector('cropper-image')!.getBoundingClientRect()
      return {
        row,
        picture,
        destroy: () => {
          wrapper.unmount()
          frame.remove()
        },
      }
    }

    it('shows a small picture at its natural size, centred', async () => {
      const { row, picture, destroy } = await mountInRow(SMALL_IMAGE, 900)
      expect(picture.width).toBeCloseTo(SMALL_IMAGE.naturalWidth, 0)
      expect(picture.height).toBeCloseTo(SMALL_IMAGE.naturalHeight, 0)
      expect(picture.left - row.left).toBeCloseTo((900 - SMALL_IMAGE.naturalWidth) / 2, 0)
      destroy()
    })

    it('scales a large picture down to the width of the row', async () => {
      const { row, picture, destroy } = await mountInRow(LANDSCAPE_IMAGE, 520)
      expect(picture.width).toBeCloseTo(520, 0)
      expect(picture.height).toBeCloseTo((520 * LANDSCAPE_IMAGE.naturalHeight) / LANDSCAPE_IMAGE.naturalWidth, 0)
      expect(picture.left).toBeCloseTo(row.left, 0)
      destroy()
    })
  })

  // A disabled cropper must still follow its frame. `DamAssetImageRoiSelect` disables it while
  // it pushes a stored region in, and a layout change in that window must not be missed.
})
