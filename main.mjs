// Orca plugin: copy files like .env from the main checkout into every new
// worktree.
//
// Runs in Orca's plugin worker (plain Node). Like orca-sbx, it relies on the
// worker being unsandboxed Node to run `git`, read the settings file and copy
// files outside the plugin's own folder. Orca's plugin panels can't save
// settings yet, so the file list lives in a plain text file.
import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, matchesGlob } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const SETTINGS_FILE = join(homedir(), '.config', 'autocopy', 'files')
const DEFAULT_SETTINGS = `# Autocopy: files copied from a repo's main checkout into each new Orca worktree.
# A repo can add its own list in an .autocopy file in its root, same format.
# One path per line, relative to the repo root. Globs work: **/.env matches
# .env in the root and in every subfolder. Lines starting with # are ignored.
# Existing files in the worktree are never overwritten.
**/.env
**/.env.local
`

// Optional per-repo list in the main checkout's root, added to the global one.
export const REPO_FILE = '.autocopy'

// Never searched: large and never what you want copied.
const SKIP_DIRS = new Set(['node_modules', '.git'])

// Creates the settings file with the defaults the first time.
export async function ensureSettings() {
  await mkdir(dirname(SETTINGS_FILE), { recursive: true })
  await writeFile(SETTINGS_FILE, DEFAULT_SETTINGS, { flag: 'wx' }).catch((err) => {
    if (err.code !== 'EEXIST') throw err
  })
}

export function parseSettings(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

async function readList(file) {
  try {
    return parseSettings(await readFile(file, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

// Global list plus the repo's own .autocopy, if it has one.
export async function readPatterns(source) {
  await ensureSettings()
  const patterns = [...(await readList(SETTINGS_FILE)), ...(await readList(join(source, REPO_FILE)))]
  return [...new Set(patterns)]
}

// The first entry of `git worktree list` is always the main checkout. Returns
// null for a bare repo, which has no checkout to copy from.
export async function mainCheckout(worktreePath) {
  const { stdout } = await run('git', ['-C', worktreePath, 'worktree', 'list', '--porcelain'])
  const entry = stdout.split('\n\n')[0].split('\n')
  if (entry.includes('bare')) return null
  return entry[0].replace(/^worktree /, '')
}

// Files in `source` matching the patterns, as paths relative to it. Walks the
// tree instead of using fs.glob, whose ** skips dotfiles like .env. Only files
// inside `source` are ever visited, so a pattern can't reach outside the repo.
export async function matchFiles(source, patterns) {
  const files = []
  async function walk(dir) {
    for (const entry of await readdir(join(source, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) await walk(rel)
      else if (entry.isFile() && patterns.some((p) => matchesGlob(rel, p))) files.push(rel)
    }
  }
  await walk('')
  return files.sort()
}

// Copies each matching file that isn't in the worktree yet. Never overwrites.
// Returns the paths that were copied.
export async function copyFiles(worktreePath) {
  const source = await mainCheckout(worktreePath)
  if (!source || source === worktreePath) return []
  const patterns = await readPatterns(source)
  if (patterns.length === 0) return []
  const copied = []
  for (const file of await matchFiles(source, patterns)) {
    const target = join(worktreePath, file)
    try {
      await mkdir(dirname(target), { recursive: true })
      await copyFile(join(source, file), target, constants.COPYFILE_EXCL)
      copied.push(file)
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
  }
  return copied
}

export default function activate(orca) {
  const notify = (title, body) =>
    orca.host.call('notifications.show', { title, body }).catch(() => {})

  const errorText = (err) => (err.stderr || err.message).trim()

  ensureSettings().catch((err) => orca.log(`could not create ${SETTINGS_FILE}: ${err.message}`))

  orca.commands.register('edit-files', async () => {
    try {
      await ensureSettings()
      await run('open', ['-t', SETTINGS_FILE])
      return { ok: true }
    } catch (err) {
      notify('Autocopy', `Could not open ${SETTINGS_FILE}: ${errorText(err)}`)
      return { ok: false }
    }
  })

  orca.events.on('worktree.created', async ({ path }) => {
    try {
      const copied = await copyFiles(path)
      if (copied.length === 0) return
      orca.log(`copied ${copied.join(', ')} into ${path}`)
      notify('Files copied', `${copied.join(', ')} → ${basename(path)}`)
    } catch (err) {
      orca.log(`copy failed for ${path}: ${errorText(err)}`)
      notify('Files not copied', `${basename(path)}: ${errorText(err)}`)
    }
  })
}
