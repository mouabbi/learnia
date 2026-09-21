# Git guide — 03 Authentication

Branch: `feature/auth-phase-a`

First branch of the project: it carries all the existing code (foundation, architecture, auth phase A). Later phases: `feature/auth-phase-b`, `-c`, ...

```bash
# 1. start
git switch main && git pull
git switch -c feature/auth-phase-a

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add password login and sessions"

# 3. end of session: back up
git push -u origin feature/auth-phase-a      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/auth-phase-a
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
