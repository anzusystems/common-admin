import { describe, expect, it } from 'vitest'
import type { AxiosResponse } from 'axios'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { createFakeDam, damAssetWithFile, type FakeDam } from './support/fakeDam'

// The fake DAM answers as the DAM does over the wire: with a copy. What the library does with an answer, or a test
// with a body it sent, leaves what the DAM holds as it was. It handed out the asset it held, so a component that
// wrote into an answer wrote into "the DAM", and a case passed through a conflict that was not there.

const endPoints = { asset: '/adm/v1/asset', image: '/adm/v1/image' }

const withAsset = () => {
  const dam = createFakeDam(endPoints)
  dam.assets.set(
    'asset-1',
    damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, { licence: 7, authors: ['author-1'] })
  )
  return dam
}

type Answered = { createdBy: number; flags: Record<string, boolean>; authors?: string[] }

describe('the fake DAM', () => {
  it.each<[string, (dam: FakeDam) => Promise<AxiosResponse>, (data: any) => Answered, (dam: FakeDam) => unknown]>([
    [
      'a read of the asset',
      (dam) => dam.client().get('/adm/v1/asset/asset-1'),
      (data) => data,
      (dam) => dam.assets.get('asset-1'),
    ],
    [
      'a read by ids',
      (dam) => dam.client().get('/adm/v1/asset/licence/7/ids/asset-1'),
      (data) => data.data[0],
      (dam) => dam.assets.get('asset-1'),
    ],
    [
      'a read by its file',
      (dam) => dam.client().get('/adm/v1/asset/asset-file/file-1'),
      (data) => data,
      (dam) => dam.assets.get('asset-1'),
    ],
    [
      'the file of a finished upload',
      (dam) => dam.client().patch('/adm/v1/image/file-1/uploaded', JSON.stringify({ checksum: 'sha' })),
      (data) => data,
      (dam) => dam.assets.get('asset-1')!.mainFile,
    ],
    [
      'a read a test held and then let answer',
      async (dam) => {
        const held = dam.hold('GET', dam.routes.one)
        const read = dam.client().get('/adm/v1/asset/asset-1')
        await Promise.resolve()
        held.release()
        return read
      },
      (data) => data,
      (dam) => dam.assets.get('asset-1'),
    ],
    [
      'a rule of a test that answers with the asset the DAM holds',
      (dam) => {
        dam.reply((request) =>
          request.method === 'GET' && request.url === '/adm/v1/asset/asset-1'
            ? { status: 200, data: dam.assets.get('asset-1') }
            : undefined
        )
        return dam.client().get('/adm/v1/asset/asset-1')
      },
      (data) => data,
      (dam) => dam.assets.get('asset-1'),
    ],
  ])('answers %s with a copy: what the library changes in it stays out of the DAM', async (_name, ask, pick, held) => {
    const dam = withAsset()
    const before = structuredClone(dam.assets.get('asset-1'))

    const answered = pick((await ask(dam)).data)
    expect(answered).toEqual(held(dam))
    answered.createdBy = 99
    answered.flags.changed = true
    answered.authors?.push('author-2')

    expect(dam.assets.get('asset-1')).toEqual(before)
  })

  it('keeps a body as it was sent: a test that changes it afterwards changes neither the request nor the DAM', async () => {
    const dam = withAsset()
    // A rule that writes what it is sent into the asset, as the DAM saves it.
    dam.reply((request) => {
      if (request.method !== 'PATCH' || request.url !== '/adm/v1/asset/asset-1') return undefined
      Object.assign(dam.assets.get('asset-1')!, request.data)
      return { status: 200, data: dam.assets.get('asset-1') }
    })
    const body = { authors: ['author-2'] }

    await dam.client().patch('/adm/v1/asset/asset-1', body)
    body.authors.push('author-3')

    expect(dam.requests.at(-1)!.data).toEqual({ authors: ['author-2'] })
    expect(dam.assets.get('asset-1')!.authors).toEqual(['author-2'])
  })

  it('keeps a form as it was sent: the file of a chunk is the one picked, whatever the form holds later', async () => {
    const dam = withAsset()
    const form = new FormData()
    form.append('file', new File(['a'], 'picked.jpg'))

    await dam.client().post('/adm/v1/image/file-1/chunk', form)
    form.set('file', new File(['b'], 'later.jpg'))

    expect(dam.chunkOf(dam.requests.at(-1)!)).toBe('picked.jpg')
  })
})
