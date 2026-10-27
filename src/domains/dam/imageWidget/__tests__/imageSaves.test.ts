import { describe, expect, it } from 'vitest'
import {
  holdImage,
  imageSavedSince,
  imageSavesOfOthersOver,
  noteImageSave,
} from '@/domains/dam/imageWidget/utils/imageSaves'

// The note of image saves is shared by the image widgets.
// The wait of an "edit metadata" opening for another widget's save is released and removed
// when the opening closes. Before, repeated openings over an unanswered save piled up waits.
// A note is kept while a save of it is in flight, even with no widget (a pinned widget copy is drawn
// after its configuration is read). It is dropped when nothing holds it and nothing is in flight.

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

    const copy = Symbol('copy')
    const readAt = holdImage('default', copy, 102)
    expect(imageSavedSince('default', 102, readAt)).toBeNull()
    save.answer()
    await saving
    expect(imageSavedSince('default', 102, readAt)).toEqual(image)
    holdImage('default', copy, null)

    // If the note were kept, it would offer the saved image to a
    // widget that read the image before any save (none answered).
    holdImage('default', Symbol('later'), 102)
    expect(imageSavedSince('default', 102, 0)).toBeNull()
  })
})
