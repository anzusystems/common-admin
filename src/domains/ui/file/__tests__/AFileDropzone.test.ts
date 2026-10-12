import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AFileDropzone from '@/domains/ui/file/components/AFileDropzone.vue'
import { useDropzoneGlobalDragState } from '@/domains/ui/file/composables/dropzone'
import en from '@/locales/en'

// What the dropzone looks like while a file is dragged over the page, as a browser draws it under each theme of the
// application: the real component with its real styles, under a real drag. A disabled dropzone lit up as one that
// takes the file, only without its text: its styles waited for a class it was never given. The queue dialog switches
// its dropzone off while it saves, and it covers the whole dialog.
// A dropzone has two looks under a drag: one while the file is anywhere over the page, another once it is over the
// zone. The second never showed: its rule came before the rule of the first, of the same weight, and a zone with the
// file over it has the classes of both.

// The texts of the library as the test setup renders them (English).
const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })
const TEXTS = {
  dropHere: i18n.global.t('common.system.dropzone.dropHere'),
  dropPossibility: i18n.global.t('common.system.dropzone.dropPossibility'),
}
const photo = () => new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' })
const carrying = (files: File[]) => {
  const transfer = new DataTransfer()
  files.forEach((file) => transfer.items.add(file))
  return transfer
}
const dragEvent = (type: string) =>
  new DragEvent(type, { dataTransfer: carrying([photo()]), bubbles: true, cancelable: true })

describe.each([
  // The colours of a dropzone as its styles name them: while a file is dragged over the page (`possible`), while it
  // is over the zone (`over`), and the background of its own.
  {
    theme: 'v-theme--light',
    possible: { background: 'rgb(229, 237, 241)', outline: 'rgb(186, 207, 212)' },
    over: { background: 'rgb(220, 237, 200)', outline: 'rgb(124, 179, 66)' },
    background: 'rgb(212, 212, 212)',
  },
  {
    theme: 'v-theme--dark',
    possible: { background: 'rgb(33, 37, 49)', outline: 'rgb(1, 87, 155)' },
    over: { background: 'rgb(40, 49, 33)', outline: 'rgb(51, 62, 40)' },
    background: 'rgb(57, 57, 57)',
  },
])('AFileDropzone under $theme while a file is dragged', ({ theme, possible, over, background }) => {
  let page: HTMLElement
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    page = document.createElement('div')
    page.className = theme
    document.body.append(page)
    // The application does this once, when it starts.
    useDropzoneGlobalDragState().initGlobalDragState()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useDropzoneGlobalDragState().destroyGlobalDragState()
    page.remove()
  })

  const mountZone = async (props: Record<string, unknown>) => {
    wrapper = mount(AFileDropzone, { attachTo: page, props })
    await flushPromises()
    return wrapper.find('.a-file-dropzone').element as HTMLElement
  }
  /** A file is dragged over the page, not over the dropzone. */
  const dragOverThePage = async () => {
    document.body.dispatchEvent(dragEvent('dragover'))
    await flushPromises()
  }
  /** A file is dragged over the page, and on over the dropzone. */
  const dragOver = async (zone: HTMLElement) => {
    await dragOverThePage()
    zone.dispatchEvent(dragEvent('dragenter'))
    zone.dispatchEvent(dragEvent('dragover'))
    await flushPromises()
  }
  /** The file is dragged on, off the dropzone: it is still over the page. */
  const dragOff = async (zone: HTMLElement) => {
    zone.dispatchEvent(dragEvent('dragleave'))
    await dragOverThePage()
  }
  const drop = async (zone: HTMLElement) => {
    zone.dispatchEvent(dragEvent('drop'))
    await flushPromises()
  }
  const look = (zone: HTMLElement) => {
    const style = getComputedStyle(zone)
    return { display: style.display, outline: style.outlineStyle, background: style.backgroundColor }
  }
  /** The colours the dropzone is lit up in: none while it has no outline. */
  const lit = (zone: HTMLElement) => {
    const style = getComputedStyle(zone)
    return style.outlineStyle === 'dashed' ? { background: style.backgroundColor, outline: style.outlineColor } : null
  }
  /** The texts of the dropzone that are drawn. */
  const textsShown = (zone: HTMLElement) =>
    Array.from(zone.querySelectorAll<HTMLElement>('.text'))
      .filter((text) => getComputedStyle(text).display !== 'none')
      .map((text) => text.textContent?.trim())

  // As the queue dialog has it: over the whole dialog, transparent, drawn only while a file is dragged.
  const overTheDialog = { variant: 'fill', transparent: true, hoverOnly: true }

  // The zone used to keep the colours of "a file is dragged" with the file over it, in every variant.
  it.each<[string, Record<string, unknown>]>([
    ['on its own', {}],
    ['small, without its background', { size: 'small', transparent: true }],
    ['over what it fills', { variant: 'fill' }],
    ['over what it fills, without its background (an image widget)', { variant: 'fill', transparent: true }],
    ['over what it fills, drawn only under a drag (a gallery with images)', { variant: 'fill', hoverOnly: true }],
    ['over a dialog, drawn only under a drag (the queue dialog)', overTheDialog],
    ['over the whole window', { variant: 'fullscreen' }],
  ])(
    'shows that a file can be dropped while one is dragged over the page, and that it is over the zone once it is: %s',
    async (_which, props) => {
      const zone = await mountZone(props)
      expect(lit(zone)).toBeNull()

      await dragOverThePage()
      expect(zone.classList.contains('a-file-dropzone--over')).toBe(false)
      expect(lit(zone)).toEqual(possible)
      expect(look(zone).display).toBe('flex')
      expect(textsShown(zone)).toEqual([TEXTS.dropHere])

      await dragOver(zone)
      expect(zone.classList.contains('a-file-dropzone--over')).toBe(true)
      expect(lit(zone)).toEqual(over)
      expect(textsShown(zone)).toEqual([TEXTS.dropHere])

      // Dragged on off the zone, the file is still over the page.
      await dragOff(zone)
      expect(zone.classList.contains('a-file-dropzone--over')).toBe(false)
      expect(lit(zone)).toEqual(possible)
    }
  )

  // The colour here used to be that of "a file is dragged": this case pinned it for a file over the zone as well.
  it('lights up and says where to drop, and takes the file dropped', async () => {
    const zone = await mountZone(overTheDialog)
    expect(look(zone).display).toBe('none')

    await dragOver(zone)

    expect(zone.classList.contains('a-file-dropzone--disabled')).toBe(false)
    expect(look(zone)).toEqual({ display: 'flex', outline: 'dashed', background: over.background })
    expect(textsShown(zone)).toEqual([TEXTS.dropHere])

    await drop(zone)
    expect(wrapper!.emitted('drop')).toHaveLength(1)
  })

  // Still drawn over what it covers: the file dropped lands on it, and is let pass. Neither look is its: not that of
  // a file dragged over the page, nor that of a file over it.
  it('does not light up when it is disabled, shows no box of a text, and lets the file dropped pass', async () => {
    const zone = await mountZone({ ...overTheDialog, disabled: true })
    expect(look(zone).display).toBe('none')

    await dragOverThePage()

    expect(zone.classList.contains('a-file-dropzone--disabled')).toBe(true)
    expect(look(zone)).toEqual({ display: 'flex', outline: 'none', background: 'rgba(0, 0, 0, 0)' })

    await dragOver(zone)

    expect(zone.classList.contains('a-file-dropzone--over')).toBe(true)
    expect(look(zone)).toEqual({ display: 'flex', outline: 'none', background: 'rgba(0, 0, 0, 0)' })
    expect(textsShown(zone)).toEqual([])

    await drop(zone)
    expect(wrapper!.emitted('drop')).toBeUndefined()
  })

  // One that is always drawn, with its own background: disabled, it keeps that background under the file.
  it('keeps the background of its own when it is disabled and not transparent', async () => {
    const zone = await mountZone({ disabled: true })
    expect(look(zone)).toEqual({ display: 'flex', outline: 'none', background })
    expect(textsShown(zone)).toEqual([])

    await dragOverThePage()
    expect(look(zone)).toEqual({ display: 'flex', outline: 'none', background })

    await dragOver(zone)

    expect(look(zone)).toEqual({ display: 'flex', outline: 'none', background })
    expect(textsShown(zone)).toEqual([])
  })

  it('goes back to its text when it is switched on again', async () => {
    const zone = await mountZone({ disabled: true })

    await wrapper!.setProps({ disabled: false })

    expect(zone.classList.contains('a-file-dropzone--disabled')).toBe(false)
    expect(textsShown(zone)).toEqual([TEXTS.dropPossibility])
    await dragOverThePage()
    expect(lit(zone)).toEqual(possible)
    await dragOver(zone)
    expect(look(zone)).toEqual({ display: 'flex', outline: 'dashed', background: over.background })
    expect(textsShown(zone)).toEqual([TEXTS.dropHere])
  })
})
