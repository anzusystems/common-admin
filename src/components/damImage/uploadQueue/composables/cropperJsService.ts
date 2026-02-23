import type { CropperSelection } from 'cropperjs'
import type { RegionOfInterest } from '@/types/coreDam/Roi'
import { stringToFloat, stringToInt } from '@/utils/string'

const PRECISION = 3

type CropperImageData = Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>
type CropperData = Pick<CropperSelection, 'x' | 'y' | 'width' | 'height'> & {
  rotate: number
  scaleX: number
  scaleY: number
}
type CropperSetDataOptions = Pick<CropperSelection, 'x' | 'y' | 'width' | 'height'>

export interface ACropperjsExposed {
  enable: () => void
  disable: () => void
  destroy: () => void
  getImageData: () => CropperImageData | undefined
  getData: () => CropperData | undefined
  setData: (data: CropperSetDataOptions) => void
}

export const regionToCrop = function (
  cropper: ACropperjsExposed,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number,
) {
  const imageData = cropper.getImageData()
  if (!imageData)
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
    }
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
  cropper: ACropperjsExposed,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number,
) {
  const imageData = cropper.getImageData()
  const data = cropper.getData()
  if (!imageData || !data) return regionOfInterest
  const ratio = imageData.naturalHeight / originalImageHeight

  let pointX = stringToInt((data.x / ratio).toFixed(PRECISION))
  if (pointX < 0) pointX = 0

  let pointY = stringToInt((data.y / ratio).toFixed(PRECISION))
  if (pointY < 0) pointY = 0

  let percentageWidth = stringToFloat((data.width / imageData.naturalWidth).toFixed(PRECISION))
  const validateWidth = percentageWidth * originalImageWidth + pointX
  if (validateWidth > originalImageWidth) {
    percentageWidth =
      percentageWidth - ((validateWidth - originalImageWidth) * 100) / originalImageWidth
  }

  let percentageHeight = stringToFloat((data.height / imageData.naturalHeight).toFixed(PRECISION))
  const validateHeight = percentageHeight * originalImageHeight + pointY
  if (validateHeight > originalImageHeight) {
    percentageHeight =
      percentageHeight - ((validateHeight - originalImageHeight) * 100) / originalImageHeight
  }

  regionOfInterest.pointX = pointX
  regionOfInterest.pointY = pointY
  regionOfInterest.percentageWidth = percentageWidth
  regionOfInterest.percentageHeight = percentageHeight

  return regionOfInterest
}
