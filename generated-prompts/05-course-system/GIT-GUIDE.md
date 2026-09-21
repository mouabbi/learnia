# Git guide — 05 Course System

Branch: `feature/course-system`

```bash
# 1. start
git switch main && git pull
git switch -c feature/course-system

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add Course model and CRUD"

# 3. end of session: back up
git push -u origin feature/course-system      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/course-system
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
