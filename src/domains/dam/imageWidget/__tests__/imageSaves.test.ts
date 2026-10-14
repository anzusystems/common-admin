import { describe, expect, it } from 'vitest'
import {
  holdImage,
  imageSavedSince,
  imageSavesOfOthersOver,
  noteImageSave,
} from '@/domains/dam/imageWidget/utils/imageSaves'

// The note of the saves of an image, which the image widgets of the app share. The wait of an opening of "edit
// metadata" for a save of another widget is let go, and taken off the note, once that opening closes: opened and closed
// again and again over a save that does not answer, the waits piled up. A note is kept while a save of it is on its
// way, also with no widget of the image there (the copy of a pinned widget is drawn once its configuration has been
// read), and dropped once nothing holds it and nothing is on its way.

const image = { texts: { description: 'saved', source: '' }, flags: {}, dam: {} } as never
const held = () => {
  let answer: () => void = () => undefined
  const save = new Promise<typeof image>((resolve) => (answer = () => resolve(image)))
  return { save, answer: () => answer() }
}
const settles = (promise: Promise<unknown>) =>
  Promise.race([promise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 20))])

describe('the note of the saves of an image', () => {
  it('lets the wait of an opening go at once when it is cancelled, the save still on its way', async () => {
    const sender = Symbol('sender')
    holdImage('default', sender, 101)
    const save = held()
    const saving = noteImageSave('default', 101, new Set(), save.save)

    const wait = imageSavesOfOthersOver('default', 101, new Set())!
    expect(await settles(wait.over)).toBe(false)
    wait.cancel()

    expect(await settles(wait.over)).toBe(true)
    save.answer()
    await saving
    holdImage('default', sender, null)
  })

  it('is kept while a save is on its way with no widget of the image there, and dropped once nothing holds it', async () => {
    const sender = Symbol('sender')
    holdImage('default', sender, 102)
    const save = held()
    const saving = noteImageSave('default', 102, new Set(), save.save)
    holdImage('default', sender, null)
    await new Promise((resolve) => setTimeout(resolve, 20))

    // The copy, drawn once its configuration has been read: it reads the image before the save answers.
    const copy = Symbol('copy')
    const readAt = holdImage('default', copy, 102)
    expect(imageSavedSince('default', 102, readAt)).toBeNull()
    save.answer()
    await saving
    expect(imageSavedSince('default', 102, readAt)).toEqual(image)
    holdImage('default', copy, null)

    // Kept, the note would offer the saved image to a widget that has read the image before any save (none answered).
    holdImage('default', Symbol('later'), 102)
    expect(imageSavedSince('default', 102, 0)).toBeNull()
  })
})
