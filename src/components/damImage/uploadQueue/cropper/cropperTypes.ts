/**
 * A crop rectangle, as fractions of the image between 0 and 1.
 *
 * Fractions rather than pixels on purpose: the region of interest the DAM stores is already
 * expressed that way for its size, and its anchor is a fraction of the source in all but name. Using
 * them here means nothing has to know how large the picture the cropper happens to have loaded is —
 * a detail rendition is a scaled copy of the original, and the scale cancels out of every sum.
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
