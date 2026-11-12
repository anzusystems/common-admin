import { describe, expect, it } from 'vitest'
import { useFormatAndSizeCheck } from '@/domains/ui/file/composables/formatAndSizeCheck'

const file = (name: string, size: number, type = 'image/jpeg') => new File([new Uint8Array(size)], name, { type })
const accepted = (maxSizes: Record<string, number>, files: File[]) =>
  useFormatAndSizeCheck(undefined, maxSizes)
    .checkFormatsAndSizes(files, true)
    .map((f) => f.name)

describe('useFormatAndSizeCheck size limits', () => {
  const files = [file('small.jpg', 100), file('big.jpg', 5000), file('small.png', 100, 'image/png')]

  it('limits every file with the "*" key', () => {
    expect(accepted({ '*': 1000 }, files)).toEqual(['small.jpg', 'small.png'])
  })

  it('limits by extension with a ".ext" key', () => {
    expect(accepted({ '.jpg': 1000 }, files)).toEqual(['small.jpg'])
  })

  it('limits by mime type (the form the library itself passes)', () => {
    expect(accepted({ 'image/jpeg': 1000 }, files)).toEqual(['small.jpg'])
    expect(accepted({ 'image/*': 1000 }, files)).toEqual(['small.jpg', 'small.png'])
  })

  it('accepts a file exactly at the limit, under every key form', () => {
    const exact = [file('exact.jpg', 1000)]
    expect(accepted({ '*': 1000 }, exact)).toEqual(['exact.jpg'])
    expect(accepted({ '.jpg': 1000 }, exact)).toEqual(['exact.jpg'])
    expect(accepted({ 'image/jpeg': 1000 }, exact)).toEqual(['exact.jpg'])
    expect(accepted({ 'image/*': 1000 }, exact)).toEqual(['exact.jpg'])
  })
})

describe('useFormatAndSizeCheck keys as written', () => {
  const acceptedBy = (accept: string, files: File[]) =>
    useFormatAndSizeCheck(accept, undefined)
      .checkFormatsAndSizes(files, true)
      .map((f) => f.name)

  // The file name is compared lowercased, so an uppercase key could never match, not even `PHOTO.JPG`.
  it('matches a ".EXT" key whatever the case of either side', () => {
    const files = [file('photo.JPG', 100), file('other.jpg', 100)]
    expect(accepted({ '.JPG': 1000 }, files)).toEqual(['photo.JPG', 'other.jpg'])
    expect(acceptedBy('.JPG', files)).toEqual(['photo.JPG', 'other.jpg'])
  })

  it('reads an accept list written with spaces after the commas', () => {
    expect(acceptedBy('image/png, .jpg', [file('a.jpg', 100), file('b.png', 100, 'image/png')])).toEqual([
      'a.jpg',
      'b.png',
    ])
  })
})
