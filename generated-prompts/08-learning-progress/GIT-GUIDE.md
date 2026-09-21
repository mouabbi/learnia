# Git guide — 08 Learning Progress

Branch: `feature/learning-progress`

```bash
# 1. start
git switch main && git pull
git switch -c feature/learning-progress

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add learning progress model"

# 3. end of session: back up
git push -u origin feature/learning-progress      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/learning-progress
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
