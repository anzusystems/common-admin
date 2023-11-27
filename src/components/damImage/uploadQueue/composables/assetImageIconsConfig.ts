import svg2k from '@/assets/dam-meta-icons/2k.svg'
import svg4k from '@/assets/dam-meta-icons/4k.svg'
import svg8k from '@/assets/dam-meta-icons/8k.svg'
import svgqhd from '@/assets/dam-meta-icons/qhd.svg'
import svgfhd from '@/assets/dam-meta-icons/fhd.svg'
import svgslot from '@/assets/dam-meta-icons/slot.svg'
import svglow from '@/assets/dam-meta-icons/low.svg'
import svgrss from '@/assets/dam-meta-icons/rss.svg'

export const DIMENSIONS_CONFIG = [
  {
    titleT: 'coreDam.asset.metaIcons.fullHd',
    width: 1920,
    height: 1080,
    svgSrc: svgfhd,
  },
  {
    titleT: 'coreDam.asset.metaIcons.2k',
    width: 2048,
    height: 1080,
    svgSrc: svg2k,
  },
  {
    titleT: 'coreDam.asset.metaIcons.qhd',
    width: 2560,
    height: 1440,
    svgSrc: svgqhd,
  },
  {
    titleT: 'coreDam.asset.metaIcons.4k',
    width: 3840,
    height: 2160,
    svgSrc: svg4k,
  },
  {
    titleT: 'coreDam.asset.metaIcons.8k',
    width: 7680,
    height: 4320,
    svgSrc: svg8k,
  },
]
export const ICON_SLOTS = svgslot
export const ICON_RSS = svgrss
export const ICON_LOW = svglow
export const LOW_DIMENSION = 600
