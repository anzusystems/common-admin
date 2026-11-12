import { describe, it, expect, afterEach } from 'vitest'
import '@/styles/main.scss'

function render(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}
afterEach(() => {
  document.body.innerHTML = ''
})

describe('library CSS', () => {
  it.each(['light', 'dark'])('%s theme highlights a selected datatable row', (theme) => {
    const host = render(
      `<div class="v-theme--${theme}"><div class="a-datatable"><div class="a-datatable__row a-datatable__row--selected">x</div></div></div>`
    )
    const row = host.querySelector('.a-datatable__row--selected')!
    expect(getComputedStyle(row).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})
