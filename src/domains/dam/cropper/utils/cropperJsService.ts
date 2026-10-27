import type { RegionOfInterest } from '@/domains/dam/types/Roi'
import type { CropRect } from '@/domains/dam/cropper/utils/cropperTypes'

const PRECISION = 3

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const clampFraction = (value: number) => Math.min(Math.max(value, 0), 1)

/**
 * Converts a stored region of interest to a crop rectangle and back.
 * Pure arithmetic on the source image dimensions. The region stores its size as fractions
 * and its anchor is effectively a fraction too, so the displayed image size is not needed.
 */
export const regionToCrop = (
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
): CropRect => {
  if (!(originalImageWidth > 0) || !(originalImageHeight > 0)) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  return {
    x: clampFraction(regionOfInterest.pointX / originalImageWidth),
    y: clampFraction(regionOfInterest.pointY / originalImageHeight),
    width: clampFraction(regionOfInterest.percentageWidth),
    height: clampFraction(regionOfInterest.percentageHeight),
  }
}

export const cropToRegion = (
  crop: CropRect,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
): RegionOfInterest => {
  regionOfInterest.pointX = Math.max(0, Math.round(crop.x * originalImageWidth))
  regionOfInterest.pointY = Math.max(0, Math.round(crop.y * originalImageHeight))
  regionOfInterest.percentageWidth = roundTo(clampFraction(crop.width), PRECISION)
  regionOfInterest.percentageHeight = roundTo(clampFraction(crop.height), PRECISION)

  return regionOfInterest
}
