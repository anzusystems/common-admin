import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useJobApi } from '@/domains/job/api/jobApi'
import type { JobBase } from '@/domains/job/types/Job'

// A kind job posts to two path segments. The url parameters are encoded since 2.0.0, so a slash
// inside one parameter went out as `%2F` (`/job/keyword-kind%2Fremove-from-related`).

const request = vi.fn(async () => ({ status: 200, data: {} }))
const client = (() => ({ request })) as unknown as () => AxiosInstance

const urlOf = async (resourceName: string) => {
  request.mockClear()
  await useJobApi(client, 'cms').createJob({ _resourceName: resourceName } as JobBase)

  return (request.mock.calls[0] as unknown as [{ url: string }])[0].url
}

describe('createJob url', () => {
  it.each([
    ['jobKeywordKindRemoveFromRelated', '/adm/v1/job/keyword-kind/remove-from-related'],
    ['jobKeywordKindReplaceOnRelated', '/adm/v1/job/keyword-kind/replace-on-related'],
    ['jobKeywordKindReindexRelated', '/adm/v1/job/keyword-kind/reindex-related'],
    ['jobArticleMove', '/adm/v1/job/article-move'],
    ['jobTargetPositionReindexRelated', '/adm/v1/job/target-position-reindex-related'],
  ])('posts %s to %s', async (resourceName, url) => {
    expect(await urlOf(resourceName)).toBe(url)
  })
})
