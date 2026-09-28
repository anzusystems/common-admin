import { describe, expect, it } from 'vitest'
import { useFormatAndSizeCheck } from '@/components/file/composables/formatAndSizeCheck'

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
