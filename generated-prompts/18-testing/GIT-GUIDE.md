# Git guide — 18 Testing

Branch: `feature/testing`

```bash
# 1. start
git switch main && git pull
git switch -c feature/testing

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add pytest fixtures and auth tests"

# 3. end of session: back up
git push -u origin feature/testing      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/testing
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
