import { describe, expect, it } from 'vitest'
import { mountCropper, pinch, V2_ADAPTER, wait } from '@/test/support/cropperHarness'
import { LANDSCAPE_IMAGE } from '@/test/fixtures/cropperImages'

/**
 * Zooming the picture, which is now a two-finger gesture and nothing else.
 *
 * cropper.js v1 offered wheel zoom and pinch zoom separately; the one caller turned the wheel off
 * and left pinch on, so that is what this does. The wheel is deliberately given back to the page:
 * cropper.js v2's canvas calls `preventDefault()` on every wheel event it sees, which would stop a
 * DAM user scrolling a dialog with the cursor over the picture.
 *
 * The geometry underneath is the interesting part — once the picture is bigger than the frame it
 * sits in, the crop has to stay on the part of it that is actually visible.
 */

const AR_16_9 = 16 / 9

const wheelOver = (element: HTMLElement, deltaY: number) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, deltaY })
  element.dispatchEvent(event)
  return event
}

describe('ACropper zooming', () => {
  it('lets the page keep scrolling over the picture', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    expect(wheelOver(cropper.find('cropper-canvas'), -120).defaultPrevented).toBe(false)
    cropper.destroy()
  })

  it('does not zoom on the wheel', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const before = cropper.api.displaySize().width
    for (let i = 0; i < 3; i++) {
      wheelOver(cropper.find('cropper-canvas'), -120)
      await wait(80)
    }
    expect(cropper.api.displaySize().width).toBeCloseTo(before, 0)
    cropper.destroy()
  })

  it('enlarges the picture on a two-finger pinch', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const before = cropper.api.displaySize().width
    await pinch(cropper.find('cropper-image'), 80)
    expect(cropper.api.displaySize().width).toBeGreaterThan(before + 1)
    cropper.destroy()
  })

  it('covers fewer source pixels once the picture is zoomed in', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const before = cropper.api.getData().width
    await pinch(cropper.find('cropper-image'), 80)
    expect(cropper.api.getData().width).toBeLessThan(before)
    cropper.destroy()
  })

  it('keeps the crop on the visible part of a zoomed-in picture', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      hostWidth: 520,
      props: { aspectRatio: AR_16_9 },
    })
    const canvas = cropper.find('cropper-canvas')
    await pinch(cropper.find('cropper-image'), 120)

    const canvasRect = canvas.getBoundingClientRect()
    const selection = cropper.find('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    expect(selection.x).toBeGreaterThanOrEqual(-0.5)
    expect(selection.y).toBeGreaterThanOrEqual(-0.5)
    expect(selection.x + selection.width).toBeLessThanOrEqual(canvasRect.width + 0.5)
    expect(selection.y + selection.height).toBeLessThanOrEqual(canvasRect.height + 0.5)
    cropper.destroy()
  })

  it('keeps reporting a crop inside the source after zooming in', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    await pinch(cropper.find('cropper-image'), 120)
    const data = cropper.api.getData()
    expect(data.x).toBeGreaterThanOrEqual(-1)
    expect(data.y).toBeGreaterThanOrEqual(-1)
    expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
    expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
    cropper.destroy()
  })

  // cropper.js emits `transform` before it commits the new matrix, so anything that re-measures the
  // picture on that event has to wait a tick — otherwise pinching out judges the crop against the
  // larger picture it has just replaced and leaves it hanging over the edge of the new one.
  it('pulls the crop back in when the picture is pinched out from under it', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      hostWidth: 520,
      props: { aspectRatio: AR_16_9 },
    })
    const canvas = cropper.find('cropper-canvas')
    await pinch(cropper.find('cropper-image'), -30)
    await wait(150)

    const canvasRect = canvas.getBoundingClientRect()
    const picture = cropper.find('cropper-image').getBoundingClientRect()
    const selection = cropper.find('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    const left = picture.left - canvasRect.left
    const top = picture.top - canvasRect.top

    expect(selection.x).toBeGreaterThanOrEqual(left - 1)
    expect(selection.y).toBeGreaterThanOrEqual(top - 1)
    expect(selection.x + selection.width).toBeLessThanOrEqual(left + picture.width + 1)
    expect(selection.y + selection.height).toBeLessThanOrEqual(top + picture.height + 1)
    cropper.destroy()
  })

  it('still keeps the requested aspect ratio after a pinch', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, props: { aspectRatio: AR_16_9 } })
    await pinch(cropper.find('cropper-image'), 120)
    const data = cropper.api.getData()
    expect(data.width / data.height).toBeCloseTo(AR_16_9, 1)
    cropper.destroy()
  })

  it('keeps a re-proportioned crop on the visible canvas while zoomed in', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      hostWidth: 520,
      props: { aspectRatio: AR_16_9 },
    })
    const canvas = cropper.find('cropper-canvas')
    await pinch(cropper.find('cropper-image'), 120)
    await cropper.wrapper.setProps({ aspectRatio: 0.5 })
    await wait(150)

    const canvasRect = canvas.getBoundingClientRect()
    const selection = cropper.find('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    expect(selection.x).toBeGreaterThanOrEqual(-0.5)
    expect(selection.y).toBeGreaterThanOrEqual(-0.5)
    expect(selection.x + selection.width).toBeLessThanOrEqual(canvasRect.width + 0.5)
    expect(selection.y + selection.height).toBeLessThanOrEqual(canvasRect.height + 0.5)
    cropper.destroy()
  })
})
