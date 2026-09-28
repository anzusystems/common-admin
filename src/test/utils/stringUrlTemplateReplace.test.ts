import { describe, expect, it } from 'vitest'
import { stringUrlTemplateReplace } from '@/utils/string'
import { replaceUrlParameters } from '@/services/api/apiHelper'

describe('stringUrlTemplateReplace', () => {
  // ALogDetailView: `/logs/dam/app/:id` -> logPaths.app + '/:id', id straight from route.params
  // (vue-router decodes %2F, %3F, %23 in params).
  it.each([
    ['a/b', '/adm/v1/log/app/a%2Fb'],
    ['../../user/1', '/adm/v1/log/app/..%2F..%2Fuser%2F1'],
    ['a?limit=1', '/adm/v1/log/app/a%3Flimit%3D1'],
    ['a#b', '/adm/v1/log/app/a%23b'],
  ])('keeps %s inside its own path segment', (id, expected) => {
    expect(replaceUrlParameters('/adm/v1/log/app/:id', { id })).toBe(expected)
  })

  it('does not let a parameter climb out of its path', () => {
    const url = new URL(stringUrlTemplateReplace('/adm/v1/log/app/:id', { id: '../../user/1' }), 'https://api.x')
    expect(url.pathname).toBe('/adm/v1/log/app/..%2F..%2Fuser%2F1')
  })

  it('leaves numbers and uuids as they are', () => {
    expect(stringUrlTemplateReplace('/asset/:id/x', { id: 'c1e5a3b2-0000-4000-8000-000000000001' })).toBe(
      '/asset/c1e5a3b2-0000-4000-8000-000000000001/x'
    )
    expect(stringUrlTemplateReplace('/a/:id', { id: 5 })).toBe('/a/5')
  })
})
