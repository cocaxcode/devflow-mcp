import { afterEach, beforeEach, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Storage } from '../lib/storage.js'
import { createTestClient, callTool, type TestContext } from './helpers.js'

let ctx: TestContext
const git = (...args: string[]) => execFileSync('git', args, { cwd: ctx.tempDir, encoding: 'utf8' }).trim()
beforeEach(async () => {
  ctx = await createTestClient()
  git('init', '-b', 'main')
  writeFileSync(`${ctx.tempDir}/.git/info/exclude`, '*\n')
  git('config', 'user.email', 'test@example.test')
  git('config', 'user.name', 'Test')
  git('commit', '--allow-empty', '-m', 'initial')
  git('branch', 'dev')
  git('checkout', '-b', 'feature')
  const storage = new Storage(ctx.tempDir)
  await storage.saveProject({ name: 'test', paths: [ctx.tempDir], baseBranch: 'main', jiraUrl: 'https://example.test', jiraType: 'cloud', jiraApiVersion: '3', jiraProjectKey: 'T', jiraAuth: { type: 'cloud', email: 'a', apiToken: 'b' }, gitProvider: 'github', gitAuth: { token: 'x' }, repoOwner: 'a', repoName: 'b', createdAt: '', updatedAt: '' })
  await callTool(ctx.client, 'df_project_switch', { name: 'test' })
})
afterEach(async () => ctx.cleanup())

it('blocks merging a protected development branch via a full ref', async () => {
  const result = await callTool(ctx.client, 'df_merge', { branch: 'refs/heads/dev', confirm: true })
  expect(result.isError).toBe(true)
  expect(result.text).toContain('no-merge-from-dev')
})

it.each(['--detach', 'bad..name'])('rejects invalid checkout input %s', async (branch) => {
  const result = await callTool(ctx.client, 'df_checkout', { branch })
  expect(result.isError).toBe(true)
  expect(await git('branch', '--show-current')).toBe('feature')
})

it.each(['origin/dev', 'refs/remotes/origin/dev', 'remotes/origin/dev'])('blocks development alias %s', async (branch) => {
  git('remote', 'add', 'origin', `${ctx.tempDir}/unused`)
  git('update-ref', 'refs/remotes/origin/dev', git('rev-parse', 'dev'))
  const result = await callTool(ctx.client, 'df_merge', { branch })
  expect(result.text).toContain('no-merge-from-dev')
})

it('previews and publishes a fresh branch, then skips a repeat push', async () => {
  const remote = `${ctx.tempDir}/.git/remote.git`
  execFileSync('git', ['init', '--bare', remote])
  git('remote', 'add', 'origin', remote)
  git('commit', '--allow-empty', '-m', 'feature work')
  const preview = await callTool(ctx.client, 'df_push')
  expect(JSON.parse(preview.text).action).toContain('--set-upstream')
  const pushed = await callTool(ctx.client, 'df_push', { confirm: true })
  expect(JSON.parse(pushed.text).success).toBe(true)
  expect(git('rev-parse', '@{u}')).toBe(git('rev-parse', 'HEAD'))
  const repeat = await callTool(ctx.client, 'df_push', { confirm: true })
  expect(JSON.parse(repeat.text).skipped).toBe(true)
})

it.each(['origin/release/test', 'refs/remotes/origin/release/test', 'remotes/origin/release/test'])(
  'checks out remote branch %s as a local tracking branch, without detached HEAD',
  async (branch) => {
    const remote = `${ctx.tempDir}/.git/remote.git`
    execFileSync('git', ['init', '--bare', remote])
    git('remote', 'add', 'origin', remote)
    git('push', '--set-upstream', 'origin', 'feature')
    git('push', 'origin', 'HEAD:refs/heads/release/test')
    git('fetch', 'origin')
    const result = await callTool(ctx.client, 'df_checkout', { branch })
    expect(result.isError).not.toBe(true)
    expect(git('branch', '--show-current')).toBe('release/test')
    expect(git('rev-parse', '--abbrev-ref', '@{u}')).toBe('origin/release/test')
  },
)

it('blocks a development branch qualified by a configured remote', async () => {
  git('remote', 'add', 'upstream', `${ctx.tempDir}/unused`)
  git('update-ref', 'refs/remotes/upstream/dev', git('rev-parse', 'dev'))
  const result = await callTool(ctx.client, 'df_merge', { branch: 'upstream/dev' })
  expect(result.text).toContain('no-merge-from-dev')
})

it('reports a missing upstream when checking out', async () => {
  const result = await callTool(ctx.client, 'df_checkout', { branch: 'main' })
  expect(result.isError).toBe(true)
  expect(result.text).toContain('upstream')
})

it('does not hide Git errors when status is read outside a repository', async () => {
  const { getWorkingDirStatus } = await import('../lib/git-exec.js')
  await expect(getWorkingDirStatus('/')).rejects.toThrow()
})

it.each(['push.default', 'remote.origin.push'])('pushes only the current branch with %s configured', async (setting) => {
  const remote = `${ctx.tempDir}/.git/remote.git`
  execFileSync('git', ['init', '--bare', remote])
  git('remote', 'add', 'origin', remote)
  git('push', 'origin', 'main', 'feature')
  git('branch', '--set-upstream-to', 'origin/feature', 'feature')
  git('checkout', 'main')
  git('commit', '--allow-empty', '-m', 'local main')
  git('checkout', 'feature')
  git('commit', '--allow-empty', '-m', 'local feature')
  git('tag', '-a', 'local-tag', '-m', 'local tag')
  git('config', 'push.followTags', 'true')
  const oldMain = execFileSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
  if (setting === 'push.default') git('config', setting, 'matching')
  else git('config', '--add', setting, 'refs/heads/*:refs/heads/*')
  const result = await callTool(ctx.client, 'df_push', { confirm: true })
  expect(result.isError).not.toBe(true)
  expect(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(oldMain)
  expect(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/feature'], { encoding: 'utf8' }).trim()).toBe(git('rev-parse', 'HEAD'))
  expect(execFileSync('git', ['--git-dir', remote, 'tag', '--list'], { encoding: 'utf8' }).trim()).toBe('')
})

it('blocks pushing a feature branch tracking protected main', async () => {
  const remote = `${ctx.tempDir}/.git/remote.git`
  execFileSync('git', ['init', '--bare', remote])
  git('remote', 'add', 'origin', remote)
  git('push', 'origin', 'main')
  git('branch', '--set-upstream-to', 'origin/main', 'feature')
  git('commit', '--allow-empty', '-m', 'feature work')
  const result = await callTool(ctx.client, 'df_push', { confirm: true })
  expect(result.isError).toBe(true)
  expect(result.text).toContain('no-merge-to-base')
  expect(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(git('rev-parse', 'main'))
})

it('resolves development merge aliases and merges an allowed full reference', async () => {
  const remote = `${ctx.tempDir}/.git/remote.git`
  execFileSync('git', ['init', '--bare', remote])
  git('remote', 'add', 'upstream', remote)
  git('push', 'upstream', 'dev', 'main')
  git('fetch', 'upstream')
  git('symbolic-ref', 'refs/remotes/upstream/HEAD', 'refs/remotes/upstream/dev')
  git('remote', 'add', 'origin', remote)
  git('fetch', 'origin')
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/dev')
  for (const branch of ['heads/dev', 'origin/HEAD', 'refs/heads/dev', 'refs/remotes/upstream/dev', 'upstream/HEAD']) {
    const result = await callTool(ctx.client, 'df_merge', { branch, confirm: true })
    expect(result.text, branch).toContain('no-merge-from-dev')
  }
  git('branch', 'allowed')
  git('checkout', 'allowed')
  git('commit', '--allow-empty', '-m', 'allowed work')
  git('checkout', 'feature')
  const result = await callTool(ctx.client, 'df_merge', { branch: 'refs/heads/allowed', confirm: true })
  expect(result.isError).not.toBe(true)
  expect(git('rev-parse', 'HEAD')).toBe(git('rev-parse', 'allowed'))
})

it('checks out a unique remote-only short branch and rejects ambiguous remote names', async () => {
  const remote = `${ctx.tempDir}/.git/remote.git`
  execFileSync('git', ['init', '--bare', remote])
  git('remote', 'add', 'origin', remote)
  git('push', '--set-upstream', 'origin', 'feature')
  git('push', 'origin', 'HEAD:refs/heads/release/test', 'HEAD:refs/heads/shared')
  git('fetch', 'origin')
  git('remote', 'add', 'upstream', remote)
  git('fetch', 'upstream')
  const ambiguous = await callTool(ctx.client, 'df_checkout', { branch: 'shared' })
  expect(ambiguous.isError).toBe(true)
  expect(git('branch', '--show-current')).toBe('feature')
  const explicit = await callTool(ctx.client, 'df_checkout', { branch: 'upstream/shared' })
  expect(explicit.isError).not.toBe(true)
  expect(git('branch', '--show-current')).toBe('shared')
  expect(git('rev-parse', '--abbrev-ref', '@{u}')).toBe('upstream/shared')
  git('switch', 'feature')
  git('update-ref', '-d', 'refs/remotes/upstream/release/test')
  const unique = await callTool(ctx.client, 'df_checkout', { branch: 'release/test' })
  expect(unique.isError).not.toBe(true)
  expect(git('branch', '--show-current')).toBe('release/test')
  expect(git('rev-parse', '--abbrev-ref', '@{u}')).toBe('origin/release/test')
})

it('rejects ambiguous, non-branch, and unsafe merge references', async () => {
  git('tag', 'allowed')
  git('branch', 'allowed')
  git('tag', 'tag-only')
  for (const branch of ['allowed', 'tag-only', '--help', 'feature@{1}']) {
    const result = await callTool(ctx.client, 'df_merge', { branch, confirm: true })
    expect(result.isError, branch).toBe(true)
  }
})
