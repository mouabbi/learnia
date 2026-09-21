# Git guide — 12 AI Prompt Builder

Branch: `feature/ai-prompt-builder`

```bash
# 1. start
git switch main && git pull
git switch -c feature/ai-prompt-builder

# 2. work: after each working step
git status && git diff
git add <files>
git commit -m "Add prompt template engine"

# 3. end of session: back up
git push -u origin feature/ai-prompt-builder      # later pushes: git push

# 4. done: checks pass -> open PR on GitHub -> Squash and merge -> Delete branch
# 5. clean up
git switch main && git pull
git branch -d feature/ai-prompt-builder
```

Never commit on `main`. More detail: [../GIT-WORKFLOW.md](../GIT-WORKFLOW.md).
