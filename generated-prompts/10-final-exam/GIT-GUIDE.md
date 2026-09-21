# Git guide — 10 Final Exam

Branch: `feature/final-exam`

```bash
# 1. start
git switch main && git pull
git switch -c feature/final-exam

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add final exam attempt lifecycle"

# 3. end of session: back up
git push -u origin feature/final-exam      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/final-exam
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
