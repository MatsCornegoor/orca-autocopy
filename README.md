# orca-env

An [Orca](https://www.onorca.dev/) plugin that copies your `.env` and `.env.local` files into every new worktree.

When you create a worktree in Orca, the plugin copies `.env` and `.env.local` from the repo's main checkout into the new worktree. It never overwrites a file that's already there, and skips any file the main checkout doesn't have.

Current version: **v0.1.0** · Orca 1.4 or newer

## Install

1. In Orca, open **Settings → Plugins → Install plugin**, choose the **Git URL** tab and enter:
   ```
   https://github.com/MatsCornegoor/orca-env.git#v0.1.0
   ```
2. Review the permissions and enable the plugin.
3. Create a worktree. You get a ".env copied" notification.

## Copy more files

Add them to `FILES` at the top of `main.mjs`, e.g. `['.env', '.env.local', 'apps/web/.env']`.

## Limitations

- **Unofficial workaround:** Orca's plugin API has no file or process permission yet. The plugin runs `git` and copies files with plain Node, which works today but a future Orca release could block it.
- Bare repos are skipped: there's no main checkout to copy from.

## Development

- **Load your clone:** Settings → Plugins → Development → add the folder. If a change doesn't take effect, turn the plugin off and on.
- **Release:** bump `version` in `orca-plugin.json`, update the version in this README, commit, then:
  ```sh
  git tag -a v0.1.1 -m v0.1.1 && git push origin main v0.1.1
  ```
