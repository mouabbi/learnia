# Git guide — 22 Future Versioning

Branch: `feature/versioning`

Deferred: don't start until the questions in prompts.md are answered.

```bash
# 1. start
git switch main && git pull
git switch -c feature/versioning

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add page version history"

# 3. end of session: back up
git push -u origin feature/versioning      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/versioning
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
