# Autocopy

An [Orca](https://www.onorca.dev/) plugin that copies files like `.env` into every new worktree.

When you create a worktree in Orca, the plugin copies the files you chose from the repo's main checkout into the new worktree. By default that's every `.env` and `.env.local`, in the root and in every subfolder. It never overwrites a file that's already in the worktree.

Current version: **v0.2.0** · Orca 1.4 or newer

## Install

1. In Orca, open **Settings → Plugins → Install plugin**, choose the **Git URL** tab and enter:
   ```
   https://github.com/MatsCornegoor/orca-autocopy.git#v0.2.0
   ```
2. Review the permissions and enable the plugin.
3. Create a worktree. You get a "Files copied" notification listing what was copied.

## Choose the files

**For all repos:** Cmd+J → **Autocopy: Edit files to copy**. This opens `~/.config/autocopy/files`:

```
**/.env
**/.env.local
```

**For one repo:** add an `.autocopy` file to the repo's root, in the same format. Its files are copied on top of the global list. You can commit it so everyone on the repo gets the same list.

```
# .autocopy
config/secrets.json
apps/*/.dev.vars
```

The format for both files:

- One path per line, relative to the repo root. Lines starting with `#` are ignored.
- Globs work: `*` matches within a folder, `**` matches any number of folders. `**/.env` matches `.env` and `apps/web/.env`.
- `node_modules` and `.git` are never searched, and nothing outside the repo is copied.

Changes apply to the next worktree you create; no restart needed.

## Testing locally

Settings → Plugins → Development → add this folder. After a code change, turn the plugin off and on.

## Release

Bump `version` in `orca-plugin.json`, update the version in this README, commit, then:

```sh
git tag -a v0.2.1 -m v0.2.1 && git push origin main v0.2.1
```
