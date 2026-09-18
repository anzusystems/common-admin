import { describe, expect, it } from 'vitest'
import {
  ADAPTERS,
  centerOf,
  drag,
  mountCropper,
  nextFrame,
  pinch,
  scaleOf,
  wait,
  type CropperAdapter,
} from '@/test/support/cropperHarness'
import { LANDSCAPE_IMAGE, PORTRAIT_IMAGE, SMALL_IMAGE, WIDE_IMAGE } from '@/test/fixtures/cropperImages'

/**
 * The behavioural contract both cropper components must satisfy.
 *
 * Everything asserted here is expressed in **natural image pixels**, never in displayed ones. That
 * is deliberate: the two versions lay their canvas out slightly differently (cropper.js v1 measured
 * the container through an inline `<img>`, so a font descender could inflate it by a few pixels and
 * scale a small image up with it), but the crop data a caller reads back must be identical — that
 * data is what gets persisted as a region of interest.
 *
 * The suite runs twice, once per adapter. A failure on only one side means the two have diverged.
 */

const AR_16_9 = 16 / 9

/** The crop both versions start with: `autoCropArea` of the aspect-fitted image, centred on it. */
const expectedInitialCrop = (naturalWidth: number, naturalHeight: number, aspectRatio: number, coverage = 0.8) => {
  let width = naturalWidth
  let height = naturalHeight
  if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
    if (naturalHeight * aspectRatio > naturalWidth) height = naturalWidth / aspectRatio
    else width = naturalHeight * aspectRatio
  }
  width *= coverage
  height *= coverage
  return { x: (naturalWidth - width) / 2, y: (naturalHeight - height) / 2, width, height }
}

const describeAdapter = (adapter: CropperAdapter) => {
  describe(adapter.name, () => {
    describe('readiness and teardown', () => {
      it('reports itself ready exactly once for one source image', async () => {
        const cropper = await mountCropper({ adapter })
        await wait(200)
        expect(cropper.readyCalls()).toBe(1)
        cropper.destroy()
      })

      it('has a live cropper in the DOM once ready', async () => {
        const cropper = await mountCropper({ adapter })
        expect(adapter.isDestroyed(cropper.host)).toBe(false)
        cropper.destroy()
      })

      it('leaves nothing behind when the component unmounts', async () => {
        const cropper = await mountCropper({ adapter })
        cropper.wrapper.unmount()
        await nextFrame()
        expect(adapter.isDestroyed(cropper.host)).toBe(true)
        cropper.host.remove()
      })
    })

    describe('image data', () => {
      const fixtures = [
        ['landscape', LANDSCAPE_IMAGE],
        ['portrait', PORTRAIT_IMAGE],
        ['small', SMALL_IMAGE],
        ['wide', WIDE_IMAGE],
      ] as const

      fixtures.forEach(([label, fixture]) => {
        it(`displays the ${label} source at its own aspect ratio`, async () => {
          const cropper = await mountCropper({ adapter, fixture })
          const { width, height } = cropper.api.displaySize()
          expect(width / height).toBeCloseTo(fixture.naturalWidth / fixture.naturalHeight, 2)
          cropper.destroy()
        })
      })

      it('never displays a source larger than the space it is given', async () => {
        const cropper = await mountCropper({ adapter, fixture: WIDE_IMAGE, hostWidth: 400 })
        expect(cropper.api.displaySize().width).toBeLessThanOrEqual(400)
        cropper.destroy()
      })
    })

    describe('initial crop', () => {
      const cases = [
        ['landscape, 16:9', LANDSCAPE_IMAGE, AR_16_9],
        ['landscape, square', LANDSCAPE_IMAGE, 1],
        ['portrait, 3:4', PORTRAIT_IMAGE, 0.75],
        ['wide, square', WIDE_IMAGE, 1],
        ['wide, 16:9', WIDE_IMAGE, AR_16_9],
        ['small, 16:9', SMALL_IMAGE, AR_16_9],
      ] as const

      cases.forEach(([label, fixture, aspectRatio]) => {
        it(`covers 80% of the aspect-fitted image, centred (${label})`, async () => {
          const cropper = await mountCropper({ adapter, fixture, props: { aspectRatio } })
          const data = cropper.api.getData()
          const expected = expectedInitialCrop(fixture.naturalWidth, fixture.naturalHeight, aspectRatio)
          expect(data.x).toBeCloseTo(expected.x, 0)
          expect(data.y).toBeCloseTo(expected.y, 0)
          expect(data.width).toBeCloseTo(expected.width, 0)
          expect(data.height).toBeCloseTo(expected.height, 0)
          cropper.destroy()
        })
      })

      it('honours the requested aspect ratio', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        const data = cropper.api.getData()
        expect(data.width / data.height).toBeCloseTo(AR_16_9, 2)
        cropper.destroy()
      })

      it('covers 80% of the whole image when no aspect ratio is asked for', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: NaN } })
        const data = cropper.api.getData()
        expect(data.width).toBeCloseTo(LANDSCAPE_IMAGE.naturalWidth * 0.8, 0)
        expect(data.height).toBeCloseTo(LANDSCAPE_IMAGE.naturalHeight * 0.8, 0)
        cropper.destroy()
      })

      it('produces the same crop data whatever the container is wide', async () => {
        const narrow = await mountCropper({ adapter, hostWidth: 320 })
        const wide = await mountCropper({ adapter, hostWidth: 900 })
        const narrowData = narrow.api.getData()
        const wideData = wide.api.getData()
        expect(narrowData.x).toBeCloseTo(wideData.x, 0)
        expect(narrowData.y).toBeCloseTo(wideData.y, 0)
        expect(narrowData.width).toBeCloseTo(wideData.width, 0)
        expect(narrowData.height).toBeCloseTo(wideData.height, 0)
        narrow.destroy()
        wide.destroy()
      })

      it('starts the crop inside the image', async () => {
        const cropper = await mountCropper({ adapter })
        const data = cropper.api.getData()
        expect(data.x).toBeGreaterThanOrEqual(-1)
        expect(data.y).toBeGreaterThanOrEqual(-1)
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        cropper.destroy()
      })
    })

    describe('setData / getData', () => {
      it('round-trips a crop through natural pixels', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 100, y: 90, width: 320, height: 180 })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.x).toBeCloseTo(100, 0)
        expect(data.y).toBeCloseTo(90, 0)
        expect(data.width).toBeCloseTo(320, 0)
        expect(data.height).toBeCloseTo(180, 0)
        cropper.destroy()
      })

      it('keeps the fields a partial setData leaves out', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 40, y: 30, width: 320, height: 180 })
        await nextFrame()
        await cropper.api.setData({ x: 120 })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.x).toBeCloseTo(120, 0)
        expect(data.y).toBeCloseTo(30, 0)
        expect(data.width).toBeCloseTo(320, 0)
        expect(data.height).toBeCloseTo(180, 0)
        cropper.destroy()
      })

      it('pulls a crop that starts off the top-left back onto the image', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: -200, y: -150, width: 320, height: 180 })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.x).toBeCloseTo(0, 0)
        expect(data.y).toBeCloseTo(0, 0)
        expect(data.width).toBeCloseTo(320, 0)
        expect(data.height).toBeCloseTo(180, 0)
        cropper.destroy()
      })

      it('pulls a crop that runs past the bottom-right back onto the image', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 700, y: 550, width: 320, height: 180 })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        expect(data.width).toBeCloseTo(320, 0)
        expect(data.height).toBeCloseTo(180, 0)
        cropper.destroy()
      })

      it('shrinks a crop larger than the image instead of letting it hang over the edge', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 0, y: 0, width: 4000, height: 2250 })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        expect(data.width / data.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      // Only one dimension is named, so the crop that comes back has to be re-proportioned — and the
      // proportion cannot be honoured by growing the other side past the image.
      it('keeps a crop inside the image when setData names only a height', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        await cropper.api.setData({ height: LANDSCAPE_IMAGE.naturalHeight })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.x).toBeGreaterThanOrEqual(-1)
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        expect(data.width / data.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      it('keeps a crop inside the image when setData names only a width', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        await cropper.api.setData({ width: LANDSCAPE_IMAGE.naturalWidth })
        await nextFrame()
        const data = cropper.api.getData()
        expect(data.y).toBeGreaterThanOrEqual(-1)
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        expect(data.width / data.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      // `viewMode: 0` is cropper.js v1's default and reads like "no restriction", but v1 still
      // clamped the crop box to its container, and the container was the fitted image. Neither
      // component lets a crop escape sideways, whatever the option says.
      it('keeps the crop on the image even when viewMode is 0', async () => {
        const cropper = await mountCropper({ adapter, props: { viewMode: 0 } })
        await cropper.api.setData({ x: -100, y: 40, width: 320, height: 180 })
        await nextFrame()
        expect(cropper.api.getData().x).toBeCloseTo(0, 0)
        cropper.destroy()
      })
    })

    describe('the end of a gesture', () => {
      it('is reported once a drag finishes', async () => {
        const cropper = await mountCropper({ adapter })
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x + 30, y: from.y })
        expect(cropper.cropendCalls()).toBeGreaterThan(0)
        cropper.destroy()
      })

      it('sees the finished crop when it reads getData()', async () => {
        const seen = { x: -1, width: -1 }
        const live: { api: null | (() => { x: number; width: number }) } = { api: null }
        const cropper = await mountCropper({
          adapter,
          props: {
            cropend: () => {
              const data = live.api?.()
              if (data) Object.assign(seen, data)
            },
          },
        })
        live.api = () => {
          const data = cropper.api.getData()
          return { x: data.x, width: data.width }
        }
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x + 40, y: from.y })
        expect(seen.x).toBeCloseTo(cropper.api.getData().x, 0)
        expect(seen.width).toBeCloseTo(cropper.api.getData().width, 0)
        cropper.destroy()
      })
    })

    describe('dragging the crop box', () => {
      it('translates it without changing its size', async () => {
        const cropper = await mountCropper({ adapter })
        const before = cropper.api.getData()
        const scale = scaleOf(cropper)
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x + 40, y: from.y + 20 })
        const after = cropper.api.getData()
        expect(after.width).toBeCloseTo(before.width, 0)
        expect(after.height).toBeCloseTo(before.height, 0)
        expect(after.x - before.x).toBeCloseTo(40 / scale, 0)
        expect(after.y - before.y).toBeCloseTo(20 / scale, 0)
        cropper.destroy()
      })

      it('stops at the left edge instead of leaving the image', async () => {
        const cropper = await mountCropper({ adapter })
        const before = cropper.api.getData()
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x - 600, y: from.y })
        const after = cropper.api.getData()
        expect(after.x).toBeCloseTo(0, 0)
        expect(after.width).toBeCloseTo(before.width, 0)
        cropper.destroy()
      })

      it('stops at the bottom-right edge instead of leaving the image', async () => {
        const cropper = await mountCropper({ adapter })
        const before = cropper.api.getData()
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x + 900, y: from.y + 900 })
        const after = cropper.api.getData()
        expect(after.x + after.width).toBeCloseTo(LANDSCAPE_IMAGE.naturalWidth, 0)
        expect(after.y + after.height).toBeCloseTo(LANDSCAPE_IMAGE.naturalHeight, 0)
        expect(after.width).toBeCloseTo(before.width, 0)
        cropper.destroy()
      })
    })

    describe('resizing the crop box', () => {
      it('grows from the bottom-right grip and keeps the aspect ratio', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 100, y: 100, width: 320, height: 180 })
        await nextFrame()
        const before = cropper.api.getData()
        const handle = cropper.find(adapter.seHandle)
        const from = centerOf(handle)
        await drag(handle, from, { x: from.x + 40, y: from.y + 40 })
        const after = cropper.api.getData()
        expect(after.width).toBeGreaterThan(before.width + 1)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        expect(after.x).toBeCloseTo(before.x, 0)
        expect(after.y).toBeCloseTo(before.y, 0)
        cropper.destroy()
      })

      it('never grows the crop past the image', async () => {
        const cropper = await mountCropper({ adapter })
        const handle = cropper.find(adapter.seHandle)
        const from = centerOf(handle)
        await drag(handle, from, { x: from.x + 800, y: from.y + 800 })
        const after = cropper.api.getData()
        expect(after.x + after.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(after.y + after.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      it('keeps the bottom edge still while the top grip is dragged', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 200, y: 150, width: 320, height: 180 })
        await nextFrame()
        const before = cropper.api.getData()
        const handle = cropper.find(adapter.nHandle)
        const from = centerOf(handle)
        await drag(handle, from, { x: from.x, y: from.y + 30 })
        const after = cropper.api.getData()
        expect(after.height).toBeLessThan(before.height - 1)
        expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      // A corner grip grows away from the opposite corner, so a locked ratio can demand room on a
      // side that has none. Neither version fudges the ratio to grow anyway; they simply stop.
      it('refuses to grow a corner that has nowhere to go', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        // Flush with the top edge: growing the north-east corner needs room above it.
        await cropper.api.setData({ x: 0, y: 0, width: 640, height: 360 })
        await nextFrame()
        const before = cropper.api.getData()
        const scale = scaleOf(cropper)
        const grip = cropper.find(adapter.neHandle)
        const from = centerOf(grip)
        await drag(grip, from, { x: from.x + 60 * scale, y: from.y - 34 * scale }, 6)

        const after = cropper.api.getData()
        expect(after.x).toBeCloseTo(before.x, 0)
        expect(after.y).toBeCloseTo(before.y, 0)
        expect(after.width).toBeCloseTo(before.width, 0)
        expect(after.height).toBeCloseTo(before.height, 0)
        cropper.destroy()
      })

      it('grows the north-east corner when there is room for it', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        await cropper.api.setData({ x: 80, y: 120, width: 480, height: 270 })
        await nextFrame()
        const scale = scaleOf(cropper)
        const grip = cropper.find(adapter.neHandle)
        const from = centerOf(grip)
        await drag(grip, from, { x: from.x + 60 * scale, y: from.y - 34 * scale }, 6)

        const after = cropper.api.getData()
        // The south-west corner is the pivot, so the left edge and the bottom edge stay put.
        expect(after.x).toBeCloseTo(80, 0)
        expect(after.y + after.height).toBeCloseTo(390, 0)
        expect(after.width).toBeGreaterThan(480)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      it('shrinks from the bottom-right grip', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 100, y: 100, width: 480, height: 270 })
        await nextFrame()
        const before = cropper.api.getData()
        const handle = cropper.find(adapter.seHandle)
        const from = centerOf(handle)
        await drag(handle, from, { x: from.x - 60, y: from.y - 60 })
        const after = cropper.api.getData()
        expect(after.width).toBeLessThan(before.width - 1)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })
    })

    describe('dragging a grip past the opposite edge', () => {
      // cropper.js reverses the action when a grip crosses over — a west drag becomes an east one.
      // Both versions pivot on the edge the grip crossed and then stop at the image border; the
      // numbers below are what each of them independently produces.
      it('pivots on the crossed edge and stops at the border, free-form', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: NaN } })
        await cropper.api.setData({ x: 600, y: 150, width: 150, height: 150 })
        await nextFrame()
        const scale = scaleOf(cropper)
        const grip = cropper.find(adapter.wHandle)
        const from = centerOf(grip)
        await drag(grip, from, { x: from.x + 300 * scale, y: from.y }, 6)

        const data = cropper.api.getData()
        expect(data.x).toBeCloseTo(750, 0)
        expect(data.y).toBeCloseTo(150, 0)
        expect(data.width).toBeCloseTo(50, 0)
        expect(data.height).toBeCloseTo(150, 0)
        cropper.destroy()
      })

      it('pivots on the crossed edge and keeps the aspect ratio', async () => {
        const cropper = await mountCropper({ adapter, props: { aspectRatio: AR_16_9 } })
        await cropper.api.setData({ x: 600, y: 150, width: 150, height: 84 })
        await nextFrame()
        const scale = scaleOf(cropper)
        const grip = cropper.find(adapter.wHandle)
        const from = centerOf(grip)
        await drag(grip, from, { x: from.x + 300 * scale, y: from.y }, 6)

        const data = cropper.api.getData()
        expect(data.x).toBeCloseTo(750, 0)
        expect(data.width).toBeCloseTo(50, 0)
        expect(data.width / data.height).toBeCloseTo(AR_16_9, 1)
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        cropper.destroy()
      })
    })

    describe('drawing a new crop box', () => {
      it('replaces the crop with a smaller, aspect-correct rectangle', async () => {
        const cropper = await mountCropper({ adapter })
        const before = cropper.api.getData()
        const surface = cropper.find(adapter.drawSurface)
        const rect = surface.getBoundingClientRect()
        const from = { x: rect.left + 20, y: rect.top + 20 }
        await drag(surface, from, { x: from.x + 120, y: from.y + 120 })
        const after = cropper.api.getData()
        // The two versions seed a fresh box differently (v1 starts from a minimum-size box, v2 from
        // the dragged distance), so only the properties a user would notice are pinned down here.
        expect(after.width).toBeGreaterThan(10)
        expect(after.width).toBeLessThan(before.width - 10)
        expect(after.width / after.height).toBeCloseTo(AR_16_9, 1)
        cropper.destroy()
      })

      it('keeps the new rectangle inside the image', async () => {
        const cropper = await mountCropper({ adapter })
        const surface = cropper.find(adapter.drawSurface)
        const rect = surface.getBoundingClientRect()
        const from = { x: rect.right - 30, y: rect.bottom - 30 }
        await drag(surface, from, { x: from.x + 400, y: from.y + 400 })
        const after = cropper.api.getData()
        expect(after.x).toBeGreaterThanOrEqual(-1)
        expect(after.y).toBeGreaterThanOrEqual(-1)
        expect(after.x + after.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(after.y + after.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        cropper.destroy()
      })
    })

    describe('touch', () => {
      it('moves the crop when it is dragged with a finger', async () => {
        const cropper = await mountCropper({ adapter })
        const before = cropper.api.getData()
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x + 40, y: from.y }, 4, 'touch')
        expect(cropper.api.getData().x).toBeGreaterThan(before.x + 1)
        cropper.destroy()
      })

      it('resizes the crop when a grip is dragged with a finger', async () => {
        const cropper = await mountCropper({ adapter })
        await cropper.api.setData({ x: 100, y: 100, width: 320, height: 180 })
        await nextFrame()
        const before = cropper.api.getData()
        const grip = cropper.find(adapter.seHandle)
        const from = centerOf(grip)
        await drag(grip, from, { x: from.x + 40, y: from.y + 40 }, 4, 'touch')
        expect(cropper.api.getData().width).toBeGreaterThan(before.width + 1)
        cropper.destroy()
      })

      // cropper.js v1 zoomed on a pinch by default, and did so independently of the wheel option —
      // which the DAM turns off. A tablet user pinching the picture has to keep getting that.
      it('zooms the picture on a two-finger pinch, even with zoomOnWheel off', async () => {
        const cropper = await mountCropper({ adapter, props: { zoomOnWheel: false } })
        const before = cropper.api.displaySize().width
        await pinch(cropper.find(adapter.imageBox), 80)
        expect(cropper.api.displaySize().width).toBeGreaterThan(before + 1)
        cropper.destroy()
      })

      it('keeps the crop on the picture after a pinch', async () => {
        const cropper = await mountCropper({ adapter, props: { zoomOnWheel: false } })
        await pinch(cropper.find(adapter.imageBox), 80)
        const data = cropper.api.getData()
        expect(data.x).toBeGreaterThanOrEqual(-1)
        expect(data.y).toBeGreaterThanOrEqual(-1)
        expect(data.x + data.width).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
        expect(data.y + data.height).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalHeight + 1)
        cropper.destroy()
      })
    })

    describe('wheel', () => {
      it('leaves the crop alone when zoomOnWheel is off', async () => {
        const cropper = await mountCropper({ adapter, props: { zoomOnWheel: false } })
        const before = cropper.api.getData()
        const face = cropper.find(adapter.face)
        const point = centerOf(face)
        face.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            composed: true,
            deltaY: -240,
            clientX: point.x,
            clientY: point.y,
          })
        )
        await wait(120)
        const after = cropper.api.getData()
        expect(after.x).toBeCloseTo(before.x, 0)
        expect(after.width).toBeCloseTo(before.width, 0)
        cropper.destroy()
      })
    })

    describe('a host that clips it', () => {
      // `DamAssetImageRoiSelect` gives the cropper `overflow: hidden` and a viewport-based
      // `max-height`. A tall picture has to be scaled down to fit what the host will show, not run
      // off the bottom of it — the part below the fold cannot be scrolled to or dragged back.
      const clipped = { overflow: 'hidden', maxHeight: '300px' }

      it('scales a tall picture down to the height the host allows', async () => {
        const cropper = await mountCropper({
          adapter,
          fixture: PORTRAIT_IMAGE,
          hostWidth: 520,
          props: { aspectRatio: 1, containerStyle: clipped },
        })
        const picture = cropper.api.displaySize()
        expect(picture.height).toBeCloseTo(300, 0)
        expect(picture.width).toBeCloseTo(225, 0)
        cropper.destroy()
      })

      it('keeps the whole picture on screen', async () => {
        const cropper = await mountCropper({
          adapter,
          fixture: PORTRAIT_IMAGE,
          hostWidth: 520,
          props: { aspectRatio: 1, containerStyle: clipped },
        })
        const image = cropper.find(adapter.imageBox).getBoundingClientRect()
        expect(image.height).toBeLessThanOrEqual(cropper.host.getBoundingClientRect().height + 1)
        cropper.destroy()
      })

      it('still lets the crop reach the bottom of the picture', async () => {
        const cropper = await mountCropper({
          adapter,
          fixture: PORTRAIT_IMAGE,
          hostWidth: 520,
          props: { aspectRatio: 1, containerStyle: clipped },
        })
        const face = cropper.find(adapter.face)
        const from = centerOf(face)
        await drag(face, from, { x: from.x, y: from.y + 900 }, 8)
        const data = cropper.api.getData()
        expect(data.y + data.height).toBeCloseTo(PORTRAIT_IMAGE.naturalHeight, 0)
        cropper.destroy()
      })
    })

    describe('responsive', () => {
      it('keeps the crop when the container is resized', async () => {
        const cropper = await mountCropper({ adapter, hostWidth: 640 })
        await cropper.api.setData({ x: 120, y: 90, width: 400, height: 225 })
        await nextFrame()
        const before = cropper.api.getData()

        cropper.host.style.width = '420px'
        window.dispatchEvent(new Event('resize'))
        await wait(300)

        const after = cropper.api.getData()
        expect(after.x).toBeCloseTo(before.x, -1)
        expect(after.y).toBeCloseTo(before.y, -1)
        expect(after.width).toBeCloseTo(before.width, -1)
        expect(after.height).toBeCloseTo(before.height, -1)
        cropper.destroy()
      })

      it('re-fits the image to the narrower container', async () => {
        const cropper = await mountCropper({ adapter, hostWidth: 640 })
        cropper.host.style.width = '420px'
        window.dispatchEvent(new Event('resize'))
        await wait(300)
        expect(cropper.api.displaySize().width).toBeLessThanOrEqual(421)
        cropper.destroy()
      })
    })
  })
}

describe('cropper contract', () => {
  ADAPTERS.forEach(describeAdapter)
})
