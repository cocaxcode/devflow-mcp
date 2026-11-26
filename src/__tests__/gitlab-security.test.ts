import { afterEach, expect, it, vi } from 'vitest'
import { GitLabClient } from '../lib/git/gitlab.js'

afterEach(() => vi.unstubAllGlobals())

it('rejects insecure static requests before sending credentials', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(GitLabClient.getProjectId('secret', 'http://example.test', 'a', 'b')).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('rejects insecure instance URLs and disables redirects for both request paths', async () => {
  expect(() => new GitLabClient('secret', 'http://example.test', 1)).toThrow()
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
  vi.stubGlobal('fetch', fetchMock)
  await GitLabClient.getProjectId('secret', 'https://example.test', 'a', 'b')
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
  await new GitLabClient('secret', 'https://example.test', 1).findPullRequest('feature')
  expect(fetchMock.mock.calls.every((call) => call[1].redirect === 'error')).toBe(true)
})
