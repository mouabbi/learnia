// Mock course catalog — stands in for the future `05-course-system` API.
// Shape: Course → Module → Chapter → Page. A page is the atomic thing you
// read; a chapter carries the `points` weight used by learningProgress()
// (partial credit as its pages get read); a module is the graded unit —
// it groups chapters and carries its own end-of-module QCM, which gates
// unlocking the next module. One final exam per course, after every
// module is complete. See generated-prompts/05-course-system and
// 09-assessment-qcm for the eventual backend shape this mirrors.

function page(id, title, content) {
  return { id, title, content }
}

export const mockCourses = [
  {
    id: 'github-for-developers',
    slug: 'github-for-developers',
    title: 'GitHub for Developers',
    description:
      'Git and GitHub from first commit to CI/CD: version control, collaboration via pull requests, and shipping with GitHub Actions.',
    icon: 'GitBranch',
    color: '#4f46e5',
    difficulty: 'Beginner',
    contentStatus: 'PUBLISHED',
    estimatedMinutes: 90,
    modules: [
      {
        id: 'gh-m1',
        title: 'Git & Version Control',
        summary: 'What Git is, and the everyday commit workflow.',
        chapters: [
          {
            id: 'gh-m1-c1',
            title: 'Git Fundamentals',
            points: 20,
            pages: [
              page(
                'gh-m1-c1-p1',
                'What is Git?',
                `Git is a distributed version control system: it tracks changes to files over
time so you can recall any past version, see who changed what and why, and
let multiple people work on the same project without overwriting each
other's work. Before Git, teams often shared folders full of files named
"report_final_v2_ACTUAL.docx" — nobody could say which one was current.`,
              ),
              page(
                'gh-m1-c1-p2',
                'Git vs GitHub',
                `Git and GitHub are not the same thing. Git is the version-control tool that
runs on your machine — it works completely offline. GitHub is a hosted
service built around Git: it stores remote copies of your repositories and
adds collaboration features on top, like pull requests, issues, and CI/CD.
You can use Git without GitHub, but you can't have a GitHub repo without Git.`,
              ),
              page(
                'gh-m1-c1-p3',
                'Installing Git',
                `Git is installed from git-scm.com on Windows/macOS, or via your system's
package manager on Linux (e.g. \`apt install git\`). Once installed, confirm
it with \`git --version\`, then set your identity — it's attached to every
commit you make:

  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"`,
              ),
              page(
                'gh-m1-c1-p4',
                'Creating a Repository',
                `A repository ("repo") is a project folder Git is tracking. Turn any folder
into one with \`git init\`, which creates a hidden \`.git\` directory holding
the entire history. Nothing is tracked automatically — Git only records
changes you explicitly tell it to, which is the subject of the next chapter.`,
              ),
            ],
          },
          {
            id: 'gh-m1-c2',
            title: 'Basic Git Workflow',
            points: 20,
            pages: [
              page(
                'gh-m1-c2-p1',
                'git status',
                `\`git status\` is the command you'll run constantly — it shows which files
are modified, staged, or untracked, and what your current branch is. When
in doubt about what Git thinks is going on, run \`git status\` before doing
anything else.`,
              ),
              page(
                'gh-m1-c2-p2',
                'git add',
                `\`git add <file>\` stages a change — marking it to be included in the next
commit. Staging lets you build a commit out of only part of your working
changes instead of being forced to commit everything at once. \`git add .\`
stages everything in the current directory.`,
              ),
              page(
                'gh-m1-c2-p3',
                'git commit',
                `\`git commit -m "message"\` saves a snapshot of everything currently staged,
along with a message describing what changed. Good commit messages explain
*why*, not just *what* — the diff already shows what changed. Each commit
gets a unique hash identifying it forever.`,
              ),
              page(
                'gh-m1-c2-p4',
                'git log',
                `\`git log\` shows the commit history: hash, author, date, and message for
each commit, newest first. \`git log --oneline\` compresses each entry to a
single line — handy once a project has more than a few commits.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-gh-m1',
          questions: [
            {
              id: 'q1',
              prompt: 'What does `git add` do?',
              options: [
                { id: 'a', text: 'Permanently saves a snapshot to history' },
                { id: 'b', text: 'Stages a change to be included in the next commit' },
                { id: 'c', text: 'Uploads your code to GitHub' },
                { id: 'd', text: 'Deletes the file' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q2',
              prompt: 'Git and GitHub are:',
              options: [
                { id: 'a', text: 'Exactly the same thing' },
                { id: 'b', text: 'A local version-control tool, and a hosted service built on it' },
                { id: 'c', text: 'Two competing version-control tools' },
                { id: 'd', text: 'GitHub is required to use Git' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q3',
              prompt: 'A commit message should mainly describe:',
              options: [
                { id: 'a', text: 'Why the change was made' },
                { id: 'b', text: 'The exact line numbers changed' },
                { id: 'c', text: "The author's mood" },
                { id: 'd', text: 'Nothing — messages are optional' },
              ],
              correctOptionId: 'a',
            },
          ],
        },
      },
      {
        id: 'gh-m2',
        title: 'GitHub Fundamentals',
        summary: 'Hosting your repo, and working with remotes and branches.',
        chapters: [
          {
            id: 'gh-m2-c1',
            title: 'Introduction to GitHub',
            points: 15,
            pages: [
              page(
                'gh-m2-c1-p1',
                'What is GitHub?',
                `GitHub hosts Git repositories in the cloud and layers collaboration tools
on top: pull requests, code review, issue tracking, and automation via
GitHub Actions. It's where most open-source (and a lot of private) code
lives today.`,
              ),
              page(
                'gh-m2-c1-p2',
                'Creating a Repository',
                `On GitHub, "New repository" creates an empty remote repo with a name,
optional description, and visibility (public/private). You can initialize
it with a README, then connect a local repo to it — or clone it directly
to start working right away.`,
              ),
              page(
                'gh-m2-c1-p3',
                'Remote Repositories',
                `A "remote" is a Git repository hosted elsewhere that your local repo can
sync with — GitHub is the most common remote. The default remote name is
\`origin\`. Remotes are how your local commits reach GitHub, and how you
pull down others' changes.`,
              ),
            ],
          },
          {
            id: 'gh-m2-c2',
            title: 'Working with Remote Repositories',
            points: 20,
            pages: [
              page(
                'gh-m2-c2-p1',
                'git remote',
                `\`git remote -v\` lists the remotes configured for your repo and their URLs.
\`git remote add origin <url>\` connects a local repo to a GitHub repo for
the first time.`,
              ),
              page(
                'gh-m2-c2-p2',
                'git push',
                `\`git push origin main\` uploads your local commits on \`main\` to the
\`origin\` remote, making them visible to everyone else with access to that
repo.`,
              ),
              page(
                'gh-m2-c2-p3',
                'git pull',
                `\`git pull\` fetches commits from the remote and merges them into your
current branch in one step — it's how you catch up with changes teammates
have pushed.`,
              ),
              page(
                'gh-m2-c2-p4',
                'git clone',
                `\`git clone <url>\` downloads a full copy of a remote repository, including
its entire history, and automatically sets it up as the \`origin\` remote —
the usual way to start working on an existing project.`,
              ),
            ],
          },
          {
            id: 'gh-m2-c3',
            title: 'Branches',
            points: 20,
            pages: [
              page(
                'gh-m2-c3-p1',
                'What is a Branch?',
                `A branch is a lightweight, movable pointer to a commit — creating one is
cheap and instant. Branches let you work on a feature or fix in isolation
without touching the stable \`main\` line of history.`,
              ),
              page(
                'gh-m2-c3-p2',
                'Creating Branches',
                `\`git branch feature/login\` creates a new branch pointing at your current
commit, without switching to it. It's just a label until you start
committing on it.`,
              ),
              page(
                'gh-m2-c3-p3',
                'Switching Branches',
                `\`git switch feature/login\` (or the older \`git checkout feature/login\`)
moves you onto that branch — your working files update to match its
latest commit.`,
              ),
              page(
                'gh-m2-c3-p4',
                'Merging',
                `\`git merge feature/login\` brings that branch's changes into your current
branch. When two branches changed the same lines differently, Git can't
merge automatically — that's a merge conflict, resolved by hand before the
merge completes.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-gh-m2',
          questions: [
            {
              id: 'q1',
              prompt: 'Which command downloads a full copy of a remote repository?',
              options: [
                { id: 'a', text: 'git remote' },
                { id: 'b', text: 'git pull' },
                { id: 'c', text: 'git clone' },
                { id: 'd', text: 'git push' },
              ],
              correctOptionId: 'c',
            },
            {
              id: 'q2',
              prompt: 'What is a Git branch, technically?',
              options: [
                { id: 'a', text: 'A full copy of the entire repository' },
                { id: 'b', text: 'A movable pointer to a commit' },
                { id: 'c', text: 'A backup stored on GitHub' },
                { id: 'd', text: 'A type of commit message' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q3',
              prompt: 'A merge conflict happens when:',
              options: [
                { id: 'a', text: 'You forget to write a commit message' },
                { id: 'b', text: 'Two branches change the same lines differently' },
                { id: 'c', text: 'A branch has no commits yet' },
                { id: 'd', text: 'You push to the wrong remote' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
      {
        id: 'gh-m3',
        title: 'Collaboration',
        summary: 'Pull requests, code review, and resolving conflicts.',
        chapters: [
          {
            id: 'gh-m3-c1',
            title: 'Pull Requests',
            points: 20,
            pages: [
              page(
                'gh-m3-c1-p1',
                'What is a Pull Request?',
                `A pull request (PR) proposes merging one branch into another on GitHub. It
bundles your commits, shows a diff, and gives teammates a place to comment,
request changes, and approve before anything touches the main branch.`,
              ),
              page(
                'gh-m3-c1-p2',
                'Creating a Pull Request',
                `After pushing a feature branch, GitHub offers a "Compare & pull request"
button. You pick the target branch (usually \`main\`), add a title and
description explaining the change, and open the PR.`,
              ),
              page(
                'gh-m3-c1-p3',
                'Code Review',
                `Reviewers read the diff, leave inline comments on specific lines, and
either approve, request changes, or just comment. This is where a second
set of eyes catches bugs and shares context before code ships.`,
              ),
              page(
                'gh-m3-c1-p4',
                'Resolving Review Comments',
                `Push new commits to the same branch to address feedback — they show up
automatically on the open PR. Once reviewers approve, the PR is ready to
merge.`,
              ),
            ],
          },
          {
            id: 'gh-m3-c2',
            title: 'Merge Conflicts',
            points: 15,
            pages: [
              page(
                'gh-m3-c2-p1',
                'Understanding Conflicts',
                `A conflict occurs when Git can't automatically decide how to combine
changes — usually because two branches edited the same lines differently.
Git marks the conflicting sections directly in the file with
\`<<<<<<<\`/\`=======\`/\`>>>>>>>\` markers.`,
              ),
              page(
                'gh-m3-c2-p2',
                'Resolving Conflicts',
                `Open each conflicted file, decide which changes to keep (or combine both),
delete the conflict markers, then \`git add\` the resolved file and commit
to complete the merge.`,
              ),
              page(
                'gh-m3-c2-p3',
                'Best Practices',
                `Merge \`main\` into your feature branch often to catch conflicts early and
small, rather than all at once at the end. Small, focused branches also
conflict far less than long-lived ones.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-gh-m3',
          questions: [
            {
              id: 'q1',
              prompt: 'What does a pull request let reviewers do?',
              options: [
                { id: 'a', text: 'Nothing, it merges automatically' },
                { id: 'b', text: 'Comment, request changes, and approve before merging' },
                { id: 'c', text: 'Delete the repository' },
                { id: 'd', text: 'Rewrite git history silently' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q2',
              prompt: 'A merge conflict is resolved by:',
              options: [
                { id: 'a', text: 'Waiting for Git to pick automatically' },
                { id: 'b', text: 'Editing the conflicting sections by hand, then committing' },
                { id: 'c', text: 'Deleting one of the branches' },
                { id: 'd', text: 'Re-cloning the repository' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
      {
        id: 'gh-m4',
        title: 'GitHub Actions',
        summary: 'Automating tests and deployment with CI/CD.',
        chapters: [
          {
            id: 'gh-m4-c1',
            title: 'CI/CD Fundamentals',
            points: 15,
            pages: [
              page(
                'gh-m4-c1-p1',
                'What is CI/CD?',
                `Continuous Integration runs checks (tests, linting) automatically on every
change. Continuous Delivery/Deployment goes further, automatically shipping
changes that pass those checks. Together they catch problems early and
remove manual, error-prone release steps.`,
              ),
              page(
                'gh-m4-c1-p2',
                'GitHub Actions',
                `GitHub Actions is GitHub's built-in automation platform: workflows defined
in YAML files under \`.github/workflows/\`, triggered by events like a push
or a pull request, running on hosted or self-hosted runners.`,
              ),
              page(
                'gh-m4-c1-p3',
                'Workflows',
                `A workflow is made of one or more jobs, each made of steps — a step can
run a shell command or reuse a published "action" (a reusable unit of
automation) from GitHub's marketplace.`,
              ),
            ],
          },
          {
            id: 'gh-m4-c2',
            title: 'Building a CI Pipeline',
            points: 20,
            pages: [
              page(
                'gh-m4-c2-p1',
                'YAML Workflow',
                `A minimal workflow declares a \`name\`, an \`on:\` trigger (e.g. \`push\`), and
a \`jobs:\` section listing what runs, on which runner image (e.g.
\`ubuntu-latest\`).`,
              ),
              page(
                'gh-m4-c2-p2',
                'Running Tests',
                `A typical job checks out the code (\`actions/checkout\`), sets up the
language runtime, installs dependencies, then runs the project's test
command — failing the workflow (and blocking the PR) if tests fail.`,
              ),
              page(
                'gh-m4-c2-p3',
                'Build',
                `A build step compiles or bundles the project into deployable artifacts —
e.g. a production JS bundle or a Docker image — usually only after tests
pass.`,
              ),
              page(
                'gh-m4-c2-p4',
                'Deployment',
                `A deploy job (often gated to only run on \`main\`) ships the built
artifact to its destination — a server, a container registry, or a static
host — completing the pipeline from commit to production.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-gh-m4',
          questions: [
            {
              id: 'q1',
              prompt: 'Where do GitHub Actions workflow files live?',
              options: [
                { id: 'a', text: '.github/workflows/' },
                { id: 'b', text: '.actions/' },
                { id: 'c', text: 'workflows.yaml at the repo root' },
                { id: 'd', text: '.git/actions/' },
              ],
              correctOptionId: 'a',
            },
            {
              id: 'q2',
              prompt: 'Continuous Integration mainly refers to:',
              options: [
                { id: 'a', text: 'Manually testing before every release' },
                { id: 'b', text: 'Automatically running checks like tests on every change' },
                { id: 'c', text: 'Merging branches once a month' },
                { id: 'd', text: 'Writing documentation' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
    ],
    finalExam: {
      id: 'final-github-for-developers',
      durationMinutes: 10,
      questions: [
        {
          id: 'f1',
          prompt: 'What uniquely identifies a Git commit?',
          options: [
            { id: 'a', text: 'Its position in the file explorer' },
            { id: 'b', text: 'A hash of its contents and history' },
            { id: 'c', text: "The author's username" },
            { id: 'd', text: 'The branch name' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f2',
          prompt: 'Which command moves changes into the staging area?',
          options: [
            { id: 'a', text: 'git stage' },
            { id: 'b', text: 'git commit' },
            { id: 'c', text: 'git add' },
            { id: 'd', text: 'git push' },
          ],
          correctOptionId: 'c',
        },
        {
          id: 'f3',
          prompt: 'A branch in Git is best described as:',
          options: [
            { id: 'a', text: 'A full duplicate of the repository on disk' },
            { id: 'b', text: 'A lightweight, movable pointer to a commit' },
            { id: 'c', text: 'A GitHub-only feature' },
            { id: 'd', text: 'A compressed backup file' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f4',
          prompt: 'When does a merge conflict occur?',
          options: [
            { id: 'a', text: 'When you forget a commit message' },
            { id: 'b', text: 'When two branches edit the same lines differently' },
            { id: 'c', text: 'When a repository has too many branches' },
            { id: 'd', text: 'When you clone a repository' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f5',
          prompt: 'What is the primary purpose of a pull request?',
          options: [
            { id: 'a', text: 'To permanently delete a branch' },
            { id: 'b', text: 'To propose and review changes before merging' },
            { id: 'c', text: 'To back up your local commits' },
            { id: 'd', text: 'To rename a repository' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f6',
          prompt: 'Which of these best describes `git clone`?',
          options: [
            { id: 'a', text: 'Creates a new empty repository' },
            { id: 'b', text: 'Downloads a full copy of a remote repository' },
            { id: 'c', text: 'Deletes the remote repository' },
            { id: 'd', text: 'Stages all changes' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f7',
          prompt: 'What does a GitHub Actions workflow run on?',
          options: [
            { id: 'a', text: 'The reviewer’s local machine' },
            { id: 'b', text: 'A hosted or self-hosted runner, triggered by an event' },
            { id: 'c', text: 'Only inside pull request descriptions' },
            { id: 'd', text: 'It never actually runs code' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f8',
          prompt: 'What does `main` (or `master`) usually represent?',
          options: [
            { id: 'a', text: 'A throwaway scratch branch' },
            { id: 'b', text: 'The stable, primary line of history' },
            { id: 'c', text: 'A file inside .git' },
            { id: 'd', text: 'The commit author' },
          ],
          correctOptionId: 'b',
        },
      ],
    },
  },
  {
    id: 'python-basics',
    slug: 'python-basics',
    title: 'Python Basics',
    description: 'Variables, control flow, and functions — the foundation for everything else.',
    icon: 'Code2',
    color: '#f59e0b',
    difficulty: 'Beginner',
    contentStatus: 'PUBLISHED',
    estimatedMinutes: 40,
    modules: [
      {
        id: 'py-m1',
        title: 'Python Foundations',
        summary: 'Variables, types, and control flow.',
        chapters: [
          {
            id: 'py-m1-c1',
            title: 'Variables and Types',
            points: 25,
            pages: [
              page(
                'py-m1-c1-p1',
                'Variables',
                `Python variables don't need a declared type — the type follows the value
you assign. \`x = 5\` makes \`x\` an int; assigning \`x = "hi"\` later makes it
a str. This is convenient, but means type-related bugs surface at runtime,
not compile time.`,
              ),
              page(
                'py-m1-c1-p2',
                'Data Types',
                `The core built-in types are \`int\`, \`float\`, \`str\`, \`bool\`, \`list\`,
\`tuple\`, and \`dict\`. \`type(x)\` tells you what type a value currently is —
useful while debugging.`,
              ),
            ],
          },
          {
            id: 'py-m1-c2',
            title: 'Control Flow',
            points: 25,
            pages: [
              page(
                'py-m1-c2-p1',
                'If Statements',
                `\`if\`/\`elif\`/\`else\` branch on a condition. Python uses indentation (not
braces) to mark which statements belong to which branch — consistent
indentation isn't a style choice here, it's syntax.`,
              ),
              page(
                'py-m1-c2-p2',
                'Loops',
                `\`for x in sequence:\` iterates over any iterable — a list, string, or
range. \`while condition:\` repeats as long as the condition holds. \`break\`
exits a loop early; \`continue\` skips to the next iteration.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-py-m1',
          questions: [
            {
              id: 'q1',
              prompt: 'Which of these creates a list in Python?',
              options: [
                { id: 'a', text: '{1, 2, 3}' },
                { id: 'b', text: '(1, 2, 3)' },
                { id: 'c', text: '[1, 2, 3]' },
                { id: 'd', text: '<1, 2, 3>' },
              ],
              correctOptionId: 'c',
            },
            {
              id: 'q2',
              prompt: 'Which loop keyword iterates over a sequence?',
              options: [
                { id: 'a', text: 'for' },
                { id: 'b', text: 'loop' },
                { id: 'c', text: 'each' },
                { id: 'd', text: 'repeat' },
              ],
              correctOptionId: 'a',
            },
          ],
        },
      },
      {
        id: 'py-m2',
        title: 'Functions',
        summary: 'Packaging logic into reusable, named blocks.',
        chapters: [
          {
            id: 'py-m2-c1',
            title: 'Writing Functions',
            points: 50,
            pages: [
              page(
                'py-m2-c1-p1',
                'Defining Functions',
                `A function is defined with \`def\` and can take parameters:

  def greet(name):
      return f"Hello, {name}!"

Functions keep code DRY and give a name to a piece of logic, which makes
the calling code read like a sentence.`,
              ),
              page(
                'py-m2-c1-p2',
                'Return Values',
                `A function that reaches the end without hitting \`return\` implicitly
returns \`None\`. \`return\` can also send back a value in the middle of a
function, exiting immediately.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-py-m2',
          questions: [
            {
              id: 'q1',
              prompt: 'What keyword defines a function in Python?',
              options: [
                { id: 'a', text: 'function' },
                { id: 'b', text: 'def' },
                { id: 'c', text: 'func' },
                { id: 'd', text: 'lambda' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q2',
              prompt: 'What does a function return if it has no `return` statement?',
              options: [
                { id: 'a', text: '0' },
                { id: 'b', text: 'None' },
                { id: 'c', text: 'An empty string' },
                { id: 'd', text: 'It raises an error' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
    ],
    finalExam: {
      id: 'final-python-basics',
      durationMinutes: 5,
      questions: [
        {
          id: 'f1',
          prompt: 'What does `len([1, 2, 3])` return?',
          options: [
            { id: 'a', text: '2' },
            { id: 'b', text: '3' },
            { id: 'c', text: '6' },
            { id: 'd', text: 'An error' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f2',
          prompt: 'Which of these creates a list in Python?',
          options: [
            { id: 'a', text: '{1, 2, 3}' },
            { id: 'b', text: '(1, 2, 3)' },
            { id: 'c', text: '[1, 2, 3]' },
            { id: 'd', text: '<1, 2, 3>' },
          ],
          correctOptionId: 'c',
        },
        {
          id: 'f3',
          prompt: 'What does a function return if it has no `return` statement?',
          options: [
            { id: 'a', text: '0' },
            { id: 'b', text: 'None' },
            { id: 'c', text: 'An empty string' },
            { id: 'd', text: 'It raises an error' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f4',
          prompt: 'Which loop keyword iterates over a sequence?',
          options: [
            { id: 'a', text: 'for' },
            { id: 'b', text: 'loop' },
            { id: 'c', text: 'each' },
            { id: 'd', text: 'repeat' },
          ],
          correctOptionId: 'a',
        },
      ],
    },
  },
  {
    id: 'web-fundamentals',
    slug: 'web-fundamentals',
    title: 'Web Fundamentals',
    description: 'How the web actually works: HTTP, the DOM, and what happens when you hit Enter in the address bar.',
    icon: 'Globe',
    color: '#0d9488',
    difficulty: 'Intermediate',
    contentStatus: 'PUBLISHED',
    estimatedMinutes: 30,
    modules: [
      {
        id: 'web-m1',
        title: 'How the Web Works',
        summary: 'From URL to rendered page, and the protocol underneath.',
        chapters: [
          {
            id: 'web-m1-c1',
            title: 'Loading a Page',
            points: 50,
            pages: [
              page(
                'web-m1-c1-p1',
                'DNS & Requests',
                `Typing a URL triggers a DNS lookup (name → IP address), then your browser
opens a connection and sends an HTTP request. The server responds with
HTML.`,
              ),
              page(
                'web-m1-c1-p2',
                'Rendering',
                `The browser parses the HTML response into the DOM, then fetches linked
CSS and JS before painting pixels to the screen — this whole sequence
repeats (partially) on most navigations.`,
              ),
            ],
          },
          {
            id: 'web-m1-c2',
            title: 'HTTP Basics',
            points: 50,
            pages: [
              page(
                'web-m1-c2-p1',
                'Status Codes',
                `HTTP responses carry a status code: 2xx means success, 3xx a redirect,
4xx a client error (like 404 Not Found), 5xx a server error.`,
              ),
              page(
                'web-m1-c2-p2',
                'Methods',
                `GET requests data without side effects; POST submits data that usually
changes server state; PUT/PATCH update a resource; DELETE removes one.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-web-m1',
          questions: [
            {
              id: 'q1',
              prompt: 'What does DNS resolve a domain name to?',
              options: [
                { id: 'a', text: 'A CSS file' },
                { id: 'b', text: 'An IP address' },
                { id: 'c', text: 'A browser tab' },
                { id: 'd', text: 'A cookie' },
              ],
              correctOptionId: 'b',
            },
            {
              id: 'q2',
              prompt: 'Which status code means "Not Found"?',
              options: [
                { id: 'a', text: '200' },
                { id: 'b', text: '301' },
                { id: 'c', text: '404' },
                { id: 'd', text: '500' },
              ],
              correctOptionId: 'c',
            },
          ],
        },
      },
    ],
    finalExam: {
      id: 'final-web-fundamentals',
      durationMinutes: 4,
      questions: [
        {
          id: 'f1',
          prompt: 'What does the DOM represent?',
          options: [
            { id: 'a', text: 'A database schema' },
            { id: 'b', text: 'A structured, in-memory model of the page' },
            { id: 'c', text: 'A network protocol' },
            { id: 'd', text: 'A CSS preprocessor' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f2',
          prompt: 'Which status code means "Not Found"?',
          options: [
            { id: 'a', text: '200' },
            { id: 'b', text: '301' },
            { id: 'c', text: '404' },
            { id: 'd', text: '500' },
          ],
          correctOptionId: 'c',
        },
        {
          id: 'f3',
          prompt: 'What does HTTP stand for?',
          options: [
            { id: 'a', text: 'HyperText Transfer Protocol' },
            { id: 'b', text: 'High Traffic Transport Process' },
            { id: 'c', text: 'Host Transfer Text Program' },
            { id: 'd', text: 'HyperText Table Protocol' },
          ],
          correctOptionId: 'a',
        },
      ],
    },
  },
  {
    // Not real course content — a short, deliberately-trivial course for
    // manually testing the module-QCM and final-exam flows end-to-end,
    // including unlocking a second module, without wading through the
    // real courses' harder questions.
    id: 'qcm-test-sandbox',
    slug: 'qcm-test-sandbox',
    title: 'QCM Test Sandbox',
    description: 'Two tiny modules with obvious-answer quizzes, for testing the module-unlock and quiz flow quickly.',
    icon: 'FlaskConical',
    color: '#7c3aed',
    difficulty: 'Beginner',
    contentStatus: 'PUBLISHED',
    estimatedMinutes: 5,
    modules: [
      {
        id: 'test-m1',
        title: 'Warm-up A',
        summary: 'One page, one obvious question — confirms the module-QCM flow.',
        chapters: [
          {
            id: 'test-m1-c1',
            title: 'Basics',
            points: 50,
            pages: [
              page(
                'test-m1-c1-p1',
                'Numbers',
                `This page exists purely to test the reader flow. Read this, then answer
the one question in this module's QCM below — it's intentionally trivial.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-test-m1',
          questions: [
            {
              id: 'q1',
              prompt: 'What is 2 + 2?',
              options: [
                { id: 'a', text: '3' },
                { id: 'b', text: '4' },
                { id: 'c', text: '5' },
                { id: 'd', text: '22' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
      {
        id: 'test-m2',
        title: 'Warm-up B',
        summary: 'Unlocks after Warm-up A — two more easy questions.',
        chapters: [
          {
            id: 'test-m2-c1',
            title: 'Basics',
            points: 50,
            pages: [
              page(
                'test-m2-c1-p1',
                'Colors',
                `A second short module, to test that passing Warm-up A's QCM correctly
unlocks this one. Same idea — trivially easy questions below.`,
              ),
            ],
          },
        ],
        quiz: {
          id: 'quiz-test-m2',
          questions: [
            {
              id: 'q1',
              prompt: 'What color do you get by mixing blue and yellow?',
              options: [
                { id: 'a', text: 'Green' },
                { id: 'b', text: 'Purple' },
                { id: 'c', text: 'Orange' },
                { id: 'd', text: 'Black' },
              ],
              correctOptionId: 'a',
            },
            {
              id: 'q2',
              prompt: 'The sky is typically what color on a clear day?',
              options: [
                { id: 'a', text: 'Red' },
                { id: 'b', text: 'Blue' },
                { id: 'c', text: 'Green' },
                { id: 'd', text: 'Purple' },
              ],
              correctOptionId: 'b',
            },
          ],
        },
      },
    ],
    finalExam: {
      id: 'final-qcm-test-sandbox',
      durationMinutes: 3,
      questions: [
        {
          id: 'f1',
          prompt: 'What is 10 - 4?',
          options: [
            { id: 'a', text: '5' },
            { id: 'b', text: '6' },
            { id: 'c', text: '7' },
            { id: 'd', text: '4' },
          ],
          correctOptionId: 'b',
        },
        {
          id: 'f2',
          prompt: 'Which of these is a fruit?',
          options: [
            { id: 'a', text: 'Carrot' },
            { id: 'b', text: 'Potato' },
            { id: 'c', text: 'Apple' },
            { id: 'd', text: 'Broccoli' },
          ],
          correctOptionId: 'c',
        },
      ],
    },
  },
]

// Mock per-user progress — stands in for `08-learning-progress`. Keyed by
// course id; used to drive the "Continue learning" section on the home
// page. Shape matches progressStore.js's per-course state.
export const mockProgress = {
  'github-for-developers': {
    completedPageIds: [
      'gh-m1-c1-p1',
      'gh-m1-c1-p2',
      'gh-m1-c1-p3',
      'gh-m1-c1-p4',
      'gh-m1-c2-p1',
      'gh-m1-c2-p2',
    ],
    lastPageId: 'gh-m1-c2-p3',
    moduleQuizzes: {},
    finalExam: null,
  },
}

export function getCourseBySlug(slug) {
  return mockCourses.find((course) => course.slug === slug) ?? null
}
