import { describe, it, expect } from 'vitest'
import { parseRemoteString } from '../lib/git/detect.js'

describe('parseRemoteString', () => {
  it('parse GitHub HTTPS URL', () => {
    const result = parseRemoteString('https://github.com/cocaxcode/devflow-mcp.git')
    expect(result.provider).toBe('github')
    expect(result.owner).toBe('cocaxcode')
    expect(result.repo).toBe('devflow-mcp')
  })

  it('parse GitHub HTTPS URL without .git', () => {
    const result = parseRemoteString('https://github.com/cocaxcode/devflow-mcp')
    expect(result.provider).toBe('github')
    expect(result.owner).toBe('cocaxcode')
    expect(result.repo).toBe('devflow-mcp')
  })

  it('parse GitHub SSH URL', () => {
    const result = parseRemoteString('git@github.com:cocaxcode/devflow-mcp.git')
    expect(result.provider).toBe('github')
    expect(result.owner).toBe('cocaxcode')
    expect(result.repo).toBe('devflow-mcp')
  })

  it('parse GitHub SSH URL without .git', () => {
    const result = parseRemoteString('git@github.com:cocaxcode/devflow-mcp')
    expect(result.provider).toBe('github')
    expect(result.owner).toBe('cocaxcode')
    expect(result.repo).toBe('devflow-mcp')
  })

  it('parse GitLab Cloud HTTPS URL', () => {
    const result = parseRemoteString('https://gitlab.com/mygroup/myproject.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('mygroup')
    expect(result.repo).toBe('myproject')
  })

  it('parse GitLab Cloud SSH URL', () => {
    const result = parseRemoteString('git@gitlab.com:mygroup/myproject.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('mygroup')
    expect(result.repo).toBe('myproject')
  })

  it('parse GitLab self-hosted HTTPS URL', () => {
    const result = parseRemoteString('https://gitlab.mycompany.com/team/backend.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('team')
    expect(result.repo).toBe('backend')
  })

  it('parse GitLab self-hosted SSH URL', () => {
    const result = parseRemoteString('git@gitlab.mycompany.com:team/backend.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('team')
    expect(result.repo).toBe('backend')
  })

  it('parse GitLab nested groups HTTPS', () => {
    const result = parseRemoteString('https://gitlab.com/group/subgroup/project.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('group/subgroup')
    expect(result.repo).toBe('project')
  })

  it('parse GitLab nested groups SSH', () => {
    const result = parseRemoteString('git@gitlab.com:group/subgroup/project.git')
    expect(result.provider).toBe('gitlab')
    expect(result.owner).toBe('group/subgroup')
    expect(result.repo).toBe('project')
  })

  it('throw on invalid URL', () => {
    expect(() => parseRemoteString('not-a-url')).toThrow('No se pudo parsear')
  })
})
