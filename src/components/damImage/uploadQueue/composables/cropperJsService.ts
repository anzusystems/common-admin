import type { RegionOfInterest } from '@/types/coreDam/Roi'
import type Cropper from 'cropperjs'
import { stringToFloat, stringToInt } from '@/utils/string'

const PRECISION = 3

export const regionToCrop = function (
  cropper: Cropper,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
) {
  const imageData = cropper.getImageData()
  const ratio = imageData.naturalHeight / originalImageHeight

  return {
    x: regionOfInterest.pointX * ratio,
    y: regionOfInterest.pointY * ratio,
    width: regionOfInterest.percentageWidth * imageData.naturalWidth,
    height: regionOfInterest.percentageHeight * imageData.naturalHeight,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
  }
}

export const cropToRegion = function (
  cropper: Cropper,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
) {
  const imageData = cropper.getImageData()
  const data = cropper.getData()
  const ratio = imageData.naturalHeight / originalImageHeight

  let pointX = stringToInt((data.x / ratio).toFixed(PRECISION))
  if (pointX < 0) pointX = 0

  let pointY = stringToInt((data.y / ratio).toFixed(PRECISION))
  if (pointY < 0) pointY = 0

  let percentageWidth = stringToFloat((data.width / imageData.naturalWidth).toFixed(PRECISION))
  const validateWidth = percentageWidth * originalImageWidth + pointX
  if (validateWidth > originalImageWidth) {
    percentageWidth = percentageWidth - ((validateWidth - originalImageWidth) * 100) / originalImageWidth
  }

  let percentageHeight = stringToFloat((data.height / imageData.naturalHeight).toFixed(PRECISION))
  const validateHeight = percentageHeight * originalImageHeight + pointY
  if (validateHeight > originalImageHeight) {
    percentageHeight = percentageHeight - ((validateHeight - originalImageHeight) * 100) / originalImageHeight
  }

  regionOfInterest.pointX = pointX
  regionOfInterest.pointY = pointY
  regionOfInterest.percentageWidth = percentageWidth
  regionOfInterest.percentageHeight = percentageHeight

  return regionOfInterest
}
