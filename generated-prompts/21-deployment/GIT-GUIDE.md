# Git guide — 21 Deployment

Branch: `feature/aws-deployment`

Split by step, e.g. `feature/aws-ecr`, `feature/aws-ec2`.

```bash
# 1. start
git switch main && git pull
git switch -c feature/aws-deployment

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add ECR push workflow"

# 3. end of session: back up
git push -u origin feature/aws-deployment      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/aws-deployment
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
