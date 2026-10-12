// Orca plugin: copy the main checkout's .env into every new worktree.
//
// Runs in Orca's plugin worker (plain Node). Like orca-sbx, it relies on the
// worker being unsandboxed Node to run `git` and touch files outside the
// plugin's own folder.
import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Files copied from the main checkout, relative to the repo root.
const FILES = ['.env', '.env.local']

// The first entry of `git worktree list` is always the main checkout. Returns
// null for a bare repo, which has no checkout to copy from.
export async function mainCheckout(worktreePath) {
  const { stdout } = await run('git', ['-C', worktreePath, 'worktree', 'list', '--porcelain'])
  const entry = stdout.split('\n\n')[0].split('\n')
  if (entry.includes('bare')) return null
  return entry[0].replace(/^worktree /, '')
}

// Copies each file that exists in the main checkout and not yet in the
// worktree. Never overwrites. Returns the names that were copied.
export async function copyEnvFiles(worktreePath) {
  const source = await mainCheckout(worktreePath)
  if (!source || source === worktreePath) return []
  const copied = []
  for (const file of FILES) {
    try {
      await copyFile(join(source, file), join(worktreePath, file), constants.COPYFILE_EXCL)
      copied.push(file)
    } catch (err) {
      // Missing in the main checkout, or already in the worktree: skip.
      if (err.code !== 'ENOENT' && err.code !== 'EEXIST') throw err
    }
  }
  return copied
}

export default function activate(orca) {
  const notify = (title, body) =>
    orca.host.call('notifications.show', { title, body }).catch(() => {})

  orca.events.on('worktree.created', async ({ path }) => {
    try {
      const copied = await copyEnvFiles(path)
      if (copied.length === 0) return
      orca.log(`copied ${copied.join(', ')} into ${path}`)
      notify('.env copied', `${copied.join(', ')} → ${basename(path)}`)
    } catch (err) {
      const message = (err.stderr || err.message).trim()
      orca.log(`copy failed for ${path}: ${message}`)
      notify('.env not copied', `${basename(path)}: ${message}`)
    }
  })
}
