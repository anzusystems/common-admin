import { afterEach, describe, expect, it } from 'vitest'
import { loadCommonFonts } from '@/plugins/webfontloader'

afterEach(() => {
  document.head
    .querySelectorAll('link[data-anzu-common-fonts], link[href="https://fonts.gstatic.com"]')
    .forEach((l) => l.remove())
})

describe('loadCommonFonts', () => {
  it('links the Roboto stylesheet once, with the weights the admins use', async () => {
    await loadCommonFonts()
    await loadCommonFonts()
    const links = document.head.querySelectorAll<HTMLLinkElement>('link[data-anzu-common-fonts]')
    expect(links).toHaveLength(1)
    expect(links[0]!.rel).toBe('stylesheet')
    expect(links[0]!.href).toBe(
      'https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap'
    )
  })
})
