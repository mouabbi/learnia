# Git guide — 20 DevOps

Branch: `feature/docker`

Split in two: `feature/docker`, then `feature/ci-cd`.

```bash
# 1. start
git switch main && git pull
git switch -c feature/docker

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add backend Dockerfile"

# 3. end of session: back up
git push -u origin feature/docker      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/docker
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
