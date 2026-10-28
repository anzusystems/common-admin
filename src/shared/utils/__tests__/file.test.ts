import { describe, expect, it } from 'vitest'
import { prettyBytes, prettyDuration } from '@/shared/utils/file'

describe('utils/file', () => {
  describe('prettyBytes', () => {
    it('prints each unit', () => {
      expect(prettyBytes(0)).toBe('0 Bytes')
      expect(prettyBytes(1)).toBe('1 Bytes')
      expect(prettyBytes(1023)).toBe('1023 Bytes')
      expect(prettyBytes(1024)).toBe('1 KB')
      expect(prettyBytes(1536)).toBe('1.5 KB')
      expect(prettyBytes(5 * 1024 ** 2)).toBe('5 MB')
      expect(prettyBytes(1024 ** 3)).toBe('1 GB')
      expect(prettyBytes(1024 ** 4)).toBe('1 TB')
      expect(prettyBytes(1024 ** 8)).toBe('1 YB')
    })

    it('rounds to the requested decimals and drops trailing zeros', () => {
      expect(prettyBytes(1234567)).toBe('1.18 MB')
      expect(prettyBytes(1234567, 0)).toBe('1 MB')
      expect(prettyBytes(1234567, 4)).toBe('1.1774 MB')
      expect(prettyBytes(1536, -1)).toBe('2 KB')
      expect(prettyBytes(2 * 1024 ** 2)).toBe('2 MB')
    })

    // Documented: the unit is picked before rounding, so a size just under a boundary prints as
    // 1024 of the smaller unit.
    it('rounds up to 1024 of the smaller unit just under a boundary', () => {
      expect(prettyBytes(1024 ** 2 - 1)).toBe('1024 KB')
    })
  })

  describe('prettyDuration', () => {
    it('prints hours, minutes and seconds', () => {
      expect(prettyDuration(0)).toBe('00:00:00')
      expect(prettyDuration(59)).toBe('00:00:59')
      expect(prettyDuration(61)).toBe('00:01:01')
      expect(prettyDuration(3661)).toBe('01:01:01')
      expect(prettyDuration(86399)).toBe('23:59:59')
    })

    it('drops the fraction of a second (DAM durations are floats)', () => {
      expect(prettyDuration(12.9)).toBe('00:00:12')
      expect(prettyDuration(3599.999)).toBe('00:59:59')
    })

    // `HH` is the hours component of a duration, which wraps at a day; a 25-hour recording would
    // read as one hour.
    it('keeps counting hours past a day', () => {
      expect(prettyDuration(86400)).toBe('24:00:00')
      expect(prettyDuration(90061)).toBe('25:01:01')
    })
  })
})
