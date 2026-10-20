import { afterEach, describe, expect, it } from 'vitest'
import '@/styles/components/table.scss'

// The library styled a row of its datatables as `a-datatable__row--active`, which nothing of the library, admin-dam or
// the admins sets, in a light colour also in the dark theme. Taken out: such a row has no background of its own.
// The row the side panel of an asset list shows is framed by a class of its own (`asset-list-table__item--active`).

function render(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}
afterEach(() => {
  document.body.innerHTML = ''
})

describe('the styles of the datatable rows', () => {
  it.each(['light', 'dark'])('give a row marked active no background in the %s theme', (theme) => {
    const host = render(
      `<div class="v-theme--${theme}"><div class="a-datatable"><div class="a-datatable__row a-datatable__row--active">x</div></div></div>`
    )

    expect(getComputedStyle(host.querySelector('.a-datatable__row--active')!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })
})
