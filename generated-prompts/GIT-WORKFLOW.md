# Git workflow (short)

Git starts at folder 03. Folders 01 and 02 are already written and have no git guide;
their code ships in the first branch. Run commands in Git Bash from the project root.

## One-time setup

```bash
git init -b main
git config user.email                    # should match your GitHub email
git add .gitignore README.md generated-prompts
git status                               # frontend/ and backend/ must NOT be listed
git commit -m "Initial commit: repo skeleton and roadmap"
```
Create an **empty** repo on GitHub (no README/.gitignore/license), then:
```bash
git remote add origin https://github.com/<you>/Learnia.git
git push -u origin main
```
In GitHub: Settings -> Branches -> add a rule requiring a pull request for `main`.

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

## Conflicts / undo

- Conflict: open the file, fix the `<<<<<<<` markers, then `git add <file>` and `git commit`. Abort with `git merge --abort`.
- Unstage a file: `git restore --staged <file>`.
- Undo a merged commit: `git revert <commit>`.
- Avoid `git reset --hard`, `git push --force`, `git clean -fd`: they can destroy work.
