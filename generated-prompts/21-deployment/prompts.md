# 21 — Deployment: AWS & Production (Phases 5–6)

## Purpose
Progressive move from local Docker Compose to a real AWS deployment, then production
hardening (domain, HTTPS, monitoring, backups, security).

## Concepts that must be covered (Phase 5 — AWS)
1. EC2: host the containers (simplest path — a single instance running Docker Compose, before considering ECS/EKS)
2. ECR: private registry for built images, wired from GitHub Actions (`20-devops`)
3. S3: asset storage — this is where the `15-assets` storage abstraction pays off (swap local filesystem implementation for an S3 implementation)
4. RDS: **only if/when** moving off SQLite is justified (SQLite is fine for single-user; document this as an explicit, non-default decision, not an assumed step)
5. CloudWatch: basic logging/metrics for the EC2 instance and app logs
6. IAM: least-privilege roles/users for GitHub Actions deploy credentials and the EC2 instance

## Concepts that must be covered (Phase 6 — Production)
1. Domain + DNS (Route 53 or existing registrar)
2. HTTPS (Let's Encrypt via certbot, or an AWS-managed cert if a load balancer is introduced later)
3. Reverse proxy (nginx in front of the containers, handling TLS termination + routing)
4. Backups (SQLite file + content/assets — scheduled backup to S3)
5. Production security hardening: cookie `Secure` flag now meaningful, tightened CORS, security headers, secrets out of `.env` files and into a proper secrets mechanism (AWS Secrets Manager or SSM Parameter Store)
6. Basic monitoring/alerting (CloudWatch alarms on app health, disk space for SQLite/assets)

## Questions to answer before implementation
- Stay on SQLite in production, or migrate to RDS Postgres? → **Defer this decision** to when Phase 5 actually starts; SQLite on a single EC2 instance with EBS + S3 backups is a legitimate, simpler choice for a single-user app, and migrating is itself a good later learning exercise — don't pre-commit either way now.
- EC2 single-instance vs. ECS/Fargate? → Recommend starting with a single EC2 instance running Docker Compose (matches the "progressive" instruction and keeps Phase 5's first pass simple); ECS/Fargate can be a deliberate later exercise, not a Phase 5 requirement.

## Dependencies
- 20-devops

## Implementation prompts that will eventually be required
1. ECR setup + push workflow (extends `20-devops` CI)
2. EC2 provisioning + Docker Compose deploy (manual first, then scripted)
3. S3 asset storage implementation (using the `15-assets` storage interface)
4. IAM roles/policies for deploy + runtime
5. Domain + HTTPS setup (nginx + certbot or equivalent)
6. Backup strategy (SQLite + assets → S3, scheduled)
7. CloudWatch logging/metrics + basic alarms
8. Production security hardening pass (cookies, CORS, headers, secrets)
9. (Optional, explicit decision point) RDS migration, if/when pursued

## Learning opportunities
- Real AWS deployment fundamentals (EC2, IAM, S3, ECR, CloudWatch)
- Reverse proxy + TLS termination
- Secrets management outside of `.env` files
- Backup/restore discipline for a stateful single-instance app
- Deciding when a "simple" deployment (single EC2) is actually the right call vs. premature complexity (ECS/Fargate, RDS)
