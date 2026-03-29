import { execFile } from 'node:child_process'
import type { WorkingDirStatus } from './types.js'

export async function gitExec(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || stdout?.trim() || error.message
        reject(new Error(message))
        return
      }
      resolve(stdout.trim())
    })
  })
}

export async function gitExecRaw(args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile('git', args, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        code: error ? (child.exitCode ?? 1) : 0,
        stdout: (stdout ?? '').trim(),
        stderr: (stderr ?? '').trim(),
      })
    })
  })
}

export async function getWorkingDirStatus(cwd?: string): Promise<WorkingDirStatus> {
  const uncommittedFiles: string[] = []
  const unpushedCommits: string[] = []

  // Cambios sin commitear
  const statusOutput = await gitExec(['status', '--porcelain'], cwd)
  if (statusOutput) {
    uncommittedFiles.push(...statusOutput.split('\n').filter(Boolean))
  }

  // Commits sin pushear
  try {
    const logOutput = await gitExec(['log', '@{u}..', '--oneline'], cwd)
    if (logOutput) {
      unpushedCommits.push(...logOutput.split('\n').filter(Boolean))
    }
  } catch {
    // No upstream configurado — no hay commits sin pushear por definicion
  }

  return {
    clean: uncommittedFiles.length === 0 && unpushedCommits.length === 0,
    uncommittedFiles,
    unpushedCommits,
  }
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
  return gitExec(['branch', '--show-current'], cwd)
}

export async function detectBaseBranch(cwd?: string): Promise<string> {
  // Intentar symbolic-ref primero
  try {
    const ref = await gitExec(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd)
    // refs/remotes/origin/main → main
    return ref.replace('refs/remotes/origin/', '')
  } catch {
    // Fallback: verificar si existe origin/main o origin/master
  }

  try {
    await gitExec(['rev-parse', '--verify', 'origin/main'], cwd)
    return 'main'
  } catch {
    // main no existe
  }

  try {
    await gitExec(['rev-parse', '--verify', 'origin/master'], cwd)
    return 'master'
  } catch {
    // master tampoco existe
  }

  throw new Error('No se pudo detectar la rama base (main/master). Configura baseBranch manualmente.')
}
