import type { RegionOfInterest } from "@/types/coreDam/Roi";
import type { CropRect } from "@/components/damImage/uploadQueue/cropper/cropperTypes";

const PRECISION = 3;

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clampFraction = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * A stored region of interest as a crop rectangle, and back.
 *
 * Both are pure arithmetic on the source image's own dimensions — no cropper involved. The region
 * already keeps its size as fractions, and its anchor is a fraction of the source in all but name,
 * so nothing here needs to know how large the picture the cropper happens to be showing is. That
 * used to matter: the conversion went through the displayed image's natural size, which cancelled
 * out of every sum it appeared in and took a rounding correction of its own to patch up.
 */
export const regionToCrop = (
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number,
): CropRect => {
  if (!(originalImageWidth > 0) || !(originalImageHeight > 0)) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  return {
    x: clampFraction(regionOfInterest.pointX / originalImageWidth),
    y: clampFraction(regionOfInterest.pointY / originalImageHeight),
    width: clampFraction(regionOfInterest.percentageWidth),
    height: clampFraction(regionOfInterest.percentageHeight),
  };
};

export const cropToRegion = (
  crop: CropRect,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number,
): RegionOfInterest => {
  regionOfInterest.pointX = Math.max(
    0,
    Math.round(crop.x * originalImageWidth),
  );
  regionOfInterest.pointY = Math.max(
    0,
    Math.round(crop.y * originalImageHeight),
  );
  regionOfInterest.percentageWidth = roundTo(
    clampFraction(crop.width),
    PRECISION,
  );
  regionOfInterest.percentageHeight = roundTo(
    clampFraction(crop.height),
    PRECISION,
  );

  return regionOfInterest;
};
