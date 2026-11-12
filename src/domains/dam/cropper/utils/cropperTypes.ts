/**
 * A crop rectangle as fractions of the image, between 0 and 1.
 * Fractions match how the DAM stores the region of interest. The loaded
 * rendition is a scaled copy of the original, so no code needs its pixel size.
 */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}
