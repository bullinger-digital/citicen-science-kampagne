#!/usr/bin/env bash
set -e -u

APP_NAME=citizen-science-app
STACK_NAME=$APP_NAME
DEPLOYMENT_TIMEOUT_SECONDS=240
IMAGE=ghcr.io/bullinger-digital/bullinger-citizen-science:latest

echo "Deploying $APP_NAME..."
cd citizen-science

# Prepare ssh-config directory and git config file
mkdir -p ./ssh-config
# Touch gitconfig file if not exists
touch gitconfig

echo " * Login to docker..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u $ --password-stdin

echo " * Pull images..."
docker pull "$IMAGE"

# DOCKER INITIALIZATION
if docker node ls > /dev/null 2>&1; then
  echo " * Swarm already initialized"
else
  echo " * Docker swarm initializing.."
  docker swarm init
fi

echo " * Deploying..."
IMAGE=$IMAGE \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
AUTH0_SECRET="$AUTH0_SECRET" \
AUTH0_BASE_URL="$AUTH0_BASE_URL" \
AUTH0_ISSUER_BASE_URL="$AUTH0_ISSUER_BASE_URL" \
AUTH0_CLIENT_ID="$AUTH0_CLIENT_ID" \
AUTH0_CLIENT_SECRET="$AUTH0_CLIENT_SECRET" \
TINA_CLIENT_ID="$TINA_CLIENT_ID" \
TINA_TOKEN="$TINA_TOKEN" \
RESTIC_BACKUP_AWS_ACCESS_KEY_ID="$RESTIC_BACKUP_AWS_ACCESS_KEY_ID" \
RESTIC_BACKUP_AWS_SECRET_ACCESS_KEY="$RESTIC_BACKUP_AWS_SECRET_ACCESS_KEY" \
RESTIC_BACKUP_PASSWORD="$RESTIC_BACKUP_PASSWORD" \
RESTIC_BACKUP_REPOSITORY="$RESTIC_BACKUP_REPOSITORY" \
  docker stack deploy --compose-file docker-compose.yml --prune $STACK_NAME --detach=false --with-registry-auth

echo " * Awaiting docker stack... (timeout: $DEPLOYMENT_TIMEOUT_SECONDS seconds)"
sh docker-stack-wait.sh -t $DEPLOYMENT_TIMEOUT_SECONDS $STACK_NAME

echo " * Migrating database..."
docker exec $(docker ps --filter name=citizen-science-app_citizen-science-app.1. -q) npm run migrate-prod

echo " * Docker prune..."
docker system prune -af

echo " * Logout from docker..."
docker logout ghcr.io

echo "Deploying $APP_NAME finished."