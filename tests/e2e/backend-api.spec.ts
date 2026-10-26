import { test, expect, fetchMockState } from './helpers'

/**
 * Contract checks for the API surface the browser code relies on. These make
 * sure the mock backend speaks the same GitHub-shaped JSON the UI expects.
 */
test.describe('Backend API contract', () => {
  test('directory listing returns a JSON array of entries', async ({ request }) => {
    const response = await request.get(
      '/api/repos/mockuser/demo-notes/contents?path=notes'
    )
    expect(response.status()).toBe(200)

    const entries = await response.json()
    expect(Array.isArray(entries)).toBe(true)
    const paths = entries.map((entry: { path: string }) => entry.path)
    expect(paths).toContain('notes/secret.md.age')
    expect(paths).toContain('notes/todo.md')
  })

  test('file response uses base64 content and the GitHub encoding field', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/repos/mockuser/demo-notes/contents?path=README.md'
    )
    expect(response.status()).toBe(200)

    const file = await response.json()
    expect(file.encoding).toBe('base64')
    expect(file.type).toBe('file')
    expect(file.sha).toBeTruthy()
    expect(Buffer.from(file.content, 'base64').toString('utf-8')).toContain(
      'Demo Notes'
    )
  })

  test('missing files return 404 (not 500)', async ({ request }) => {
    const response = await request.get(
      '/api/repos/mockuser/scratch/contents?path=.gitcloak'
    )
    expect(response.status()).toBe(404)
  })

  test('saving through the API stores encrypted content and reset restores the seed', async ({
    request,
  }) => {
    const save = await request.post('/api/repos/mockuser/scratch/save', {
      data: {
        path: 'api-created.md.age',
        content: '-----BEGIN AGE ENCRYPTED FILE-----\nfake\n-----END AGE ENCRYPTED FILE-----',
        message: 'Create api-created.md.age',
      },
    })
    expect(save.status()).toBe(200)
    const saveBody = await save.json()
    expect(saveBody.success).toBe(true)
    expect(saveBody.path).toBe('api-created.md.age')

    let state = await fetchMockState(request)
    expect(state['mockuser/scratch']['api-created.md.age']).toContain(
      'BEGIN AGE ENCRYPTED FILE'
    )

    const reset = await request.post('/api/test/reset')
    expect(reset.status()).toBe(200)

    state = await fetchMockState(request)
    expect(state['mockuser/scratch']['api-created.md.age']).toBeUndefined()
    // Original seed content is back.
    expect(state['mockuser/scratch']['notes.md']).toContain('Scratch')
  })

  test('save rejects plaintext, non-.age paths and workflow paths', async ({ request }) => {
    const armor = '-----BEGIN AGE ENCRYPTED FILE-----\nfake\n-----END AGE ENCRYPTED FILE-----'
    const bad = [
      { path: 'plain.md.age', content: 'not encrypted' },
      { path: 'plain.md', content: armor },
      { path: '.github/workflows/x.yml.age', content: armor },
      { path: '../escape.age', content: armor },
    ]
    for (const data of bad) {
      const response = await request.post('/api/repos/mockuser/scratch/save', { data })
      expect(response.status(), JSON.stringify(data)).toBe(400)
    }
  })

  test('save rejects cross-origin browser requests', async ({ request }) => {
    const response = await request.post('/api/repos/mockuser/scratch/save', {
      headers: { origin: 'https://evil.example' },
      data: {
        path: 'x.md.age',
        content: '-----BEGIN AGE ENCRYPTED FILE-----\nfake\n-----END AGE ENCRYPTED FILE-----',
      },
    })
    expect(response.status()).toBe(403)
  })

  test('contents rejects traversal paths and bad repository names', async ({ request }) => {
    const traversal = await request.get('/api/repos/mockuser/scratch/contents?path=../x')
    expect(traversal.status()).toBe(400)
    const badRepo = await request.get('/api/repos/mockuser/..%2Fx/contents')
    expect(badRepo.status()).toBe(400)
  })

  test('responses carry security headers and a CSP without remote scripts', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['content-security-policy']).toContain("object-src 'none'")
    expect(headers['content-security-policy']).not.toContain('vercel.live')
    const api = await request.get('/api/repos/mockuser/scratch/contents')
    expect(api.headers()['cache-control']).toContain('no-store')
  })
})
