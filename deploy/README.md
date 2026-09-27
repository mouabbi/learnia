# Deploying Learnia — CI/CD v1 (simple version)

Workflows: `.github/workflows/ci.yml` (automatic) and `cd.yml` (manual button)

```
CI  (automatic)  push to main / pull request ─▶ test-backend + test-frontend

CD  (button: Actions > CD > Run workflow, choose one)
      build             ─▶ build-push                (images → Docker Hub)
      deploy            ─▶ deploy                    (existing images → VPS)
      build-and-deploy  ─▶ build-push ─▶ deploy
```

On the VPS:
```
Internet ─https─▶ host nginx (already on the VPS, picks the app by domain)
                    └─ learnia.example.com ─▶ 127.0.0.1:8080 ─▶ frontend container (nginx)
                                                                 └─ /api ─▶ backend container
```

## Setup (once)

**1. Docker Hub** — create 2 **public** repositories: `learnia-backend`, `learnia-frontend`,
and an access token (Account settings → Personal access tokens, Read & Write).

**2. DNS** — an **A record**: `learnia.example.com → <VPS IP>`.

**3. VPS** (Ubuntu, as root):
```bash
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/learnia && chown deploy:deploy /opt/learnia
```
Then as `deploy`, create `/opt/learnia/.env` and `/opt/learnia/backend.env`
from the two `.example` files in this folder (in `.env`, choose an `APP_PORT`
that no other app on the VPS uses).

**3b. Host nginx + HTTPS** — add a site for learnia to the nginx already on the VPS,
using `nginx-host.conf` (the steps are at the top of that file; `certbot --nginx`
adds the HTTPS certificate).

**4. SSH key** (on your PC):
```bash
ssh-keygen -t ed25519 -f learnia_deploy -N ""
```
Put the content of `learnia_deploy.pub` in `/home/deploy/.ssh/authorized_keys` on the VPS.

**5. GitHub** → repo Settings:
- **Secrets and variables → Actions**
  - Variables: `DOCKERHUB_USERNAME`, `DOMAIN`
  - Secrets: `DOCKERHUB_TOKEN`, `VPS_HOST` (the IP), `VPS_USER` (`deploy`),
    `VPS_SSH_KEY` (content of the **private** file `learnia_deploy`)
- **Environments → New environment `production`** (just a name that groups the deploy history;
  "Required reviewers" needs a paid plan for private repos — the manual button replaces it)

**6. Deploy** → merge to `main` and wait for **CI** to be green → Actions tab → **CD** →
**Run workflow** → branch `main`, action `build-and-deploy` → open `https://learnia.example.com`.

**Rollback** → CD → Run workflow → action `deploy`, image_tag = an older commit SHA.

Useful on the VPS:
```bash
cd /opt/learnia
docker compose -f docker-compose.prod.yml --env-file .env --env-file .image_tag ps
docker compose -f docker-compose.prod.yml --env-file .env --env-file .image_tag logs -f backend
```

---

## Roadmap: from v1 to a production-grade pipeline

Do them one at a time; each one is a small change you can understand and test.

| # | Improvement | Problem it solves |
|---|---|---|
| 1 | **Cache** (`cache: npm`, `enable-cache: true`, Docker layer cache with `docker/build-push-action`) | Every run downloads everything again → slow pipeline |
| 2 | **Build the images on pull requests too** (build only, no push) | A broken Dockerfile is only found after merging to main |
| 3 | **`concurrency`** for CI and deploy | Two fast pushes → two deploys running at the same time |
| 4 | **Pin the VPS host key** (secret `VPS_SSH_KNOWN_HOSTS` instead of `ssh-keyscan` in the pipeline) | `ssh-keyscan` trusts whatever server answers — a fake server could receive your deploy |
| 5 | **Wait for "healthy" instead of `sleep 20`** + retry the health check | Sometimes the app needs more than 20s → false failure; sometimes it's broken but `sleep` hides why |
| 6 | **Database backup before each deploy** | A bad migration can break or lose data with no way back |
| 7 | **Automatic rollback** (save the last working tag, go back if unhealthy) | A broken version stays live until you fix it by hand |
| 8 | **Manual deploy of any SHA** (`workflow_dispatch`) | No easy way to redeploy an old version |
| 9 | **Private images** + `docker login` on the VPS with a read-only token | Anyone can pull your images |
| 10 | **Split CI and CD** into 2 workflows (`workflow_run`) | One big file gets hard to read as it grows |
| 11 | **Off-server backups** (cron + rsync / object storage) | If the VPS dies, the backups die with it |
| 12 | **Monitoring + alerts** (uptime check, error logs) | You learn the site is down from your users |
