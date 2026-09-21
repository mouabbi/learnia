# Git guide — 11 Content Workspace / CMS

Branch: `feature/content-workspace-cms`

```bash
# 1. start
git switch main && git pull
git switch -c feature/content-workspace-cms

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add workspace shell"

# 3. end of session: back up
git push -u origin feature/content-workspace-cms      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/content-workspace-cms
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
