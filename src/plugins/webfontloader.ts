// The weights the webfontloader call asked for, straight from Google Fonts (webfontloader has had no
// release since 2017 and injected the same stylesheet).
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap'

export async function loadCommonFonts(): Promise<void> {
  if (typeof document === 'undefined' || document.querySelector('link[data-anzu-common-fonts]')) return
  const preconnect = document.createElement('link')
  preconnect.rel = 'preconnect'
  preconnect.href = 'https://fonts.gstatic.com'
  preconnect.crossOrigin = ''
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONTS_HREF
  link.dataset.anzuCommonFonts = ''
  document.head.append(preconnect, link)
}
