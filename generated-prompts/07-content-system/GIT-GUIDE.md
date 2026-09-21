# Git guide — 07 Content System

Branch: `feature/content-system`

```bash
# 1. start
git switch main && git pull
git switch -c feature/content-system

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add page content block schemas"

# 3. end of session: back up
git push -u origin feature/content-system      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/content-system
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
