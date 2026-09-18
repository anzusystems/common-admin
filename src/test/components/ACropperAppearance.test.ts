import { describe, expect, it } from 'vitest'
import { mountCropper, nextFrame, V1_ADAPTER, V2_ADAPTER, wait } from '@/test/support/cropperHarness'
import { LANDSCAPE_IMAGE, PORTRAIT_IMAGE, SMALL_IMAGE } from '@/test/fixtures/cropperImages'

/**
 * What the new cropper looks like, pinned against the stylesheet cropper.js v1 shipped.
 *
 * The v1 component drew the crop box out of plain elements whose colours lived in `cropper.css`;
 * the v2 elements take theirs from a `--theme-color` custom property inside each shadow root. The
 * values below are the ones read straight out of `cropper.css` (`.cropper-view-box` outline,
 * `.cropper-face`, `.cropper-dashed`, `.cropper-center`, `.cropper-point`, `.cropper-modal`), so a
 * change in either direction is a change to how the crop looks and shows up as a failure.
 */

const themeColorOf = (element: Element) => getComputedStyle(element).getPropertyValue('--theme-color').trim()

const normaliseColor = (value: string) => value.replace(/\s+/g, '')

describe('ACropper appearance', () => {
  it('outlines the crop box in cropper.js v1 blue', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const selection = cropper.find('cropper-selection')
    expect(selection.hasAttribute('outlined')).toBe(true)
    expect(normaliseColor(themeColorOf(selection))).toBe('rgba(51,153,255,0.75)')
    cropper.destroy()
  })

  it('matches the v1 crop box outline colour exactly', async () => {
    const v1 = await mountCropper({ adapter: V1_ADAPTER })
    const viewBox = v1.find('.cropper-view-box')
    const v1Color = normaliseColor(getComputedStyle(viewBox).outlineColor)
    v1.destroy()

    const v2 = await mountCropper({ adapter: V2_ADAPTER })
    const v2Color = normaliseColor(themeColorOf(v2.find('cropper-selection')))
    v2.destroy()

    expect(v2Color).toBe(v1Color)
  })

  it('draws a rule-of-thirds grid inside the crop box', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const grid = cropper.find('cropper-grid')
    expect(grid.getAttribute('rows')).toBe('3')
    expect(grid.getAttribute('columns')).toBe('3')
    expect(grid.hasAttribute('covered')).toBe(true)
    // v1 drew the thirds but no outer border — the blue outline already marks the edge.
    expect(grid.hasAttribute('bordered')).toBe(false)
    expect(normaliseColor(themeColorOf(grid))).toBe('rgba(238,238,238,0.5)')
    cropper.destroy()
  })

  it('renders nine grid cells', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const grid = cropper.find('cropper-grid')
    const cells = grid.shadowRoot?.querySelectorAll('span > span') ?? []
    expect(cells.length).toBe(9)
    cropper.destroy()
  })

  it('marks the centre of the crop box', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const crosshair = cropper.find('cropper-crosshair')
    expect(crosshair.hasAttribute('centered')).toBe(true)
    expect(normaliseColor(themeColorOf(crosshair))).toBe('rgba(238,238,238,0.75)')
    cropper.destroy()
  })

  it('tints the crop box face the way v1 highlighted it', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const face = cropper.find('cropper-handle[action="move"]')
    expect(normaliseColor(themeColorOf(face))).toBe('rgba(255,255,255,0.1)')
    cropper.destroy()
  })

  it('offers all eight resize grips in v1 blue', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const grips = cropper.host.querySelectorAll('cropper-handle[action$="-resize"]')
    expect(grips.length).toBe(8)
    const actions = Array.from(grips).map((grip) => grip.getAttribute('action'))
    expect(actions).toEqual(
      expect.arrayContaining([
        'n-resize',
        'e-resize',
        's-resize',
        'w-resize',
        'ne-resize',
        'nw-resize',
        'se-resize',
        'sw-resize',
      ])
    )
    grips.forEach((grip) => {
      expect(normaliseColor(themeColorOf(grip))).toBe('rgba(51,153,255,0.75)')
    })
    cropper.destroy()
  })

  it('shades everything outside the crop the way .cropper-modal did', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const shade = cropper.find('cropper-shade')
    // `.cropper-modal` was #000 at opacity .5.
    expect(normaliseColor(themeColorOf(shade))).toBe('rgba(0,0,0,0.5)')
    cropper.destroy()
  })

  it('lets the shade colour be themed, replacing the old .cropper-modal override', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      props: { shadeColor: 'rgba(241, 244, 246, 0.5)' },
    })
    expect(normaliseColor(themeColorOf(cropper.find('cropper-shade')))).toBe('rgba(241,244,246,0.5)')
    cropper.destroy()
  })

  it('keeps the shade snapped to the crop box', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    await cropper.api.setData({ x: 100, y: 90, width: 320, height: 180 })
    await nextFrame()
    const shade = cropper.find('cropper-shade') as HTMLElement & { x: number; y: number; width: number }
    const selection = cropper.find('cropper-selection') as HTMLElement & { x: number; y: number; width: number }
    expect(shade.x).toBeCloseTo(selection.x, 1)
    expect(shade.y).toBeCloseTo(selection.y, 1)
    expect(shade.width).toBeCloseTo(selection.width, 1)
    cropper.destroy()
  })

  // A photograph has nothing to see through, and the one caller always turned the checkerboard off.
  it('never draws a checkerboard behind the picture', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    expect(cropper.find('cropper-canvas').hasAttribute('background')).toBe(false)
    cropper.destroy()
  })

  it('leaves the picture decorative, with no alt text of its own', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    expect(cropper.find('cropper-image').getAttribute('alt')).toBe(null)
    cropper.destroy()
  })

  it('applies the container style to the element wrapping the canvas', async () => {
    const cropper = await mountCropper({
      adapter: V2_ADAPTER,
      props: { containerStyle: { overflow: 'hidden', maxHeight: '300px' } },
    })
    const container = cropper.find('.a-cropper__container')
    expect(container.style.overflow).toBe('hidden')
    expect(container.style.maxHeight).toBe('300px')
    cropper.destroy()
  })

  it('fills the container width and keeps the image aspect ratio', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 640 })
    const canvas = cropper.find('cropper-canvas')
    expect(canvas.getBoundingClientRect().width).toBeCloseTo(640, 0)
    expect(canvas.getBoundingClientRect().height).toBeCloseTo(480, 0)
    cropper.destroy()
  })

  it('adds no dead space under the canvas', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 640 })
    const container = cropper.find('.a-cropper__container')
    const canvas = cropper.find('cropper-canvas')
    expect(container.getBoundingClientRect().height).toBeCloseTo(canvas.getBoundingClientRect().height, 0)
    cropper.destroy()
  })

  it('displays the image at the same size cropper.js v1 did for a source wider than the container', async () => {
    const v1 = await mountCropper({ adapter: V1_ADAPTER, hostWidth: 640, fixture: LANDSCAPE_IMAGE })
    const v1Image = v1.api.displaySize()
    v1.destroy()

    const v2 = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 640, fixture: LANDSCAPE_IMAGE })
    const v2Image = v2.api.displaySize()
    v2.destroy()

    expect(v2Image.width).toBeCloseTo(v1Image.width, 0)
    expect(v2Image.height).toBeCloseTo(v1Image.height, 0)
  })

  it('gives the centre marker the 7px cropper.js v1 drew, not one that follows the page font', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const crosshair = cropper.find('cropper-crosshair')
    const rect = crosshair.getBoundingClientRect()
    expect(rect.width).toBeCloseTo(7, 0)
    expect(rect.height).toBeCloseTo(7, 0)
    cropper.destroy()
  })

  it('draws the faint band along the crop box edge that v1 had', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    const shadow = getComputedStyle(cropper.find('cropper-selection')).boxShadow
    expect(normaliseColor(shadow)).toContain('rgba(51,153,255,0.1)')
    cropper.destroy()
  })

  it('leaves a source narrower than its container centred between two shaded margins', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 520, fixture: SMALL_IMAGE })
    const canvas = cropper.find('cropper-canvas').getBoundingClientRect()
    const image = cropper.find('cropper-image').getBoundingClientRect()
    // The frame keeps the width it was given, as cropper.js v1's container did...
    expect(canvas.width).toBeCloseTo(520, 0)
    expect(canvas.height).toBeCloseTo(SMALL_IMAGE.naturalHeight, 0)
    // ...and the picture sits in the middle of it.
    expect(image.left - canvas.left).toBeCloseTo((520 - SMALL_IMAGE.naturalWidth) / 2, 0)
    cropper.destroy()
  })

  // cropper.js v1 measured its container through an inline `<img>`, so the font's descender made the
  // container a few pixels taller than the picture and the picture was then scaled up to fill it —
  // a 240px wide source came out at 247px. Nothing here reproduces that.
  it('shows a small source at its natural size instead of scaling it up by a font descender', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 520, fixture: SMALL_IMAGE })
    const picture = cropper.api.displaySize()
    expect(picture.width).toBeCloseTo(SMALL_IMAGE.naturalWidth, 0)
    expect(picture.height).toBeCloseTo(SMALL_IMAGE.naturalHeight, 0)
    cropper.destroy()
  })

  it('keeps the crop inside the picture, not inside the margins', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER, hostWidth: 520, fixture: SMALL_IMAGE })
    await cropper.api.setData({ x: -100, y: 0, width: 160, height: 90 })
    await nextFrame()
    const data = cropper.api.getData()
    expect(data.x).toBeCloseTo(0, 0)
    expect(data.x + data.width).toBeLessThanOrEqual(SMALL_IMAGE.naturalWidth + 1)
    cropper.destroy()
  })

  // `ACropperjs` measured only its own container, so a picture inside a short, clipped ancestor was
  // simply cut off at the fold — and the part of the crop down there could not be dragged back.
  it('fits the picture into an ancestor that clips it', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; max-height: 300px; overflow: hidden;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({ adapter: V2_ADAPTER, fixture: PORTRAIT_IMAGE, hostWidth: 520 })
    frame.appendChild(cropper.host)
    cropper.host.style.width = '519px'
    await wait(400)

    const picture = cropper.api.displaySize()
    expect(picture.height).toBeLessThanOrEqual(301)
    expect(picture.width / picture.height).toBeCloseTo(PORTRAIT_IMAGE.naturalWidth / PORTRAIT_IMAGE.naturalHeight, 2)
    cropper.destroy()
    frame.remove()
  })

  // An ancestor that scrolls is a different matter: what it hides is a scroll away, not gone, so
  // shrinking the picture to fit would be taking away resolution for no reason.
  it('leaves the picture alone inside an ancestor that scrolls', async () => {
    const frame = document.createElement('div')
    frame.style.cssText = 'width: 520px; max-height: 300px; overflow-y: auto;'
    document.body.appendChild(frame)

    const cropper = await mountCropper({ adapter: V2_ADAPTER, fixture: PORTRAIT_IMAGE, hostWidth: 520 })
    frame.appendChild(cropper.host)
    cropper.host.style.width = '519px'
    await wait(400)

    expect(cropper.api.displaySize().height).toBeGreaterThan(400)
    cropper.destroy()
    frame.remove()
  })

  it('hides the spinner once the cropper is ready', async () => {
    const cropper = await mountCropper({ adapter: V2_ADAPTER })
    expect(cropper.host.querySelector('.v-progress-circular')).toBeNull()
    cropper.destroy()
  })
})
