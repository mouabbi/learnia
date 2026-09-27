#!/usr/bin/env bash
# Create an admin account (or promote an existing user) in the RUNNING
# Learnia backend container. Run it on the VPS after a deploy:
#
#   cd /opt/learnia
#   bash create-admin.sh                     # asks for the email
#   bash create-admin.sh you@example.com     # or pass it
#
# The password is typed hidden and passed to the container through an
# environment variable — never on a command line (visible in `ps`) and
# never in your shell history.
set -euo pipefail

# 1. Find the backend container started by docker compose (project "learnia").
CONTAINER="$(docker ps \
  --filter "label=com.docker.compose.project=learnia" \
  --filter "label=com.docker.compose.service=backend" \
  --format '{{.Names}}' | head -n 1)"
if [ -z "$CONTAINER" ]; then
  echo "The backend container is not running. Deploy first (or check: docker ps)."
  exit 1
fi

# 2. Email: from the first argument, or ask.
EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  read -rp "Admin email: " EMAIL
fi

# 3. Password: typed twice, hidden (-s), at least 12 characters.
read -rsp "Password (hidden): " ADMIN_PASSWORD; echo
read -rsp "Repeat password:   " CONFIRM; echo
if [ "$ADMIN_PASSWORD" != "$CONFIRM" ]; then
  echo "Passwords don't match."; exit 1
fi
if [ "${#ADMIN_PASSWORD}" -lt 12 ]; then
  echo "Password too short (min 12 characters)."; exit 1
fi

# 4. Run make_admin.py inside the container.
#    "-e ADMIN_PASSWORD" with no "=value" copies the variable from THIS
#    script's environment, so the password isn't part of the command.
export ADMIN_PASSWORD
docker exec -e ADMIN_PASSWORD "$CONTAINER" python scripts/make_admin.py "$EMAIL"
unset ADMIN_PASSWORD CONFIRM
