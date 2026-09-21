# Git workflow (short)

Git starts at folder 03. Folders 01 and 02 are already written and have no git guide;
their code ships in the first branch. Run commands in Git Bash from the project root.

## Initial setup: DONE (already executed, do not repeat)

Executed for you on `main`, remote `https://github.com/mouabbi/learnia.git`:
```bash
git init -b main
git add .gitignore README.md generated-prompts     # skeleton only, no app code
git commit -m "Initial commit: repo skeleton and roadmap"
git remote add origin https://github.com/mouabbi/learnia.git
git push -u origin main
```
`main` on GitHub now holds the skeleton. `frontend/` and `backend/` are still untracked
on purpose: they go in your first branch (below). One-time, still to do on GitHub:
Settings -> Branches -> add a rule requiring a pull request for `main`.

## First branch: auth phase A (carries all existing code)

Follow `03-authentication/GIT-GUIDE.md`. At step 2 use:
```bash
git add frontend backend
git status                               # no .env, *.db, node_modules, .venv
git commit -m "Add password login and sessions"
```

## The loop

| When | Do |
|---|---|
| Start a task | `git switch main && git pull && git switch -c feature/<name>` |
| After each working step | `git status`, `git diff`, `git add <files>`, `git commit -m "..."` |
| End of session | `git push` |
| Task done, lint/build pass | open a Pull Request, **Squash and merge**, delete branch |
| After merge | `git switch main && git pull && git branch -d feature/<name>` |

## Rules

- Never commit on `main` (`git branch` shows where you are).
- One branch = one purpose. Commit small and often, with a clear imperative message.
- Stage specific files; run `git status` before every commit.
- Branch names: `feature/...`, `fix/...`, `docs/...`.

## .gitignore: what it is and how to check it

`.gitignore` is a plain list of files Git must never track (secrets, installed
packages, build output, local database, logs). Commands to use with it:
```bash
git status --ignored --short             # list ignored files (lines starting with !!)
git check-ignore -v <path>               # which rule ignores this file?
git add --dry-run frontend backend       # preview what would be committed, before adding
git rm --cached <file>                   # stop tracking a file that was committed by mistake
```
Rules: `folder/` = a folder, `*` = wildcard, `**/` = any depth, `!x` = exception (used to
keep `.env.example` tracked). Ignoring a file does nothing if it is already committed.
Never commit: `.env`, `*.db`, `node_modules`, `.venv`, `*.log`.

## Conflicts / undo

- Conflict: open the file, fix the `<<<<<<<` markers, then `git add <file>` and `git commit`. Abort with `git merge --abort`.
- Unstage a file: `git restore --staged <file>`.
- Undo a merged commit: `git revert <commit>`.
- Avoid `git reset --hard`, `git push --force`, `git clean -fd`: they can destroy work.
