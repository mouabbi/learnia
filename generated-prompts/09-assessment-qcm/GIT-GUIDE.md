# Git guide — 09 Assessment / QCM

Branch: `feature/assessment-qcm`

```bash
# 1. start
git switch main && git pull
git switch -c feature/assessment-qcm

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add assessment and question models"

# 3. end of session: back up
git push -u origin feature/assessment-qcm      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/assessment-qcm
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
