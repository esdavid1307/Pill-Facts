#!/usr/bin/env bash
#
# Replaces the backend container with IMAGE. It runs on the EC2 instance, sent over SSM
# Run Command, never by SSH (there is no port 22):
#
#   rollout.sh ghcr.io/esdavid1307/pill-facts-backend:<tag>
#
# The secrets come from SSM Parameter Store into a root-only env file. Nothing here
# prints them, and Run Command keeps this script's output, so nothing must.

set -euo pipefail

IMAGE="${1:?usage: rollout.sh <image>}"
NAME=pillfacts-backend
ENV_FILE=/etc/pillfacts/backend.env

# IMDSv2 only, so the region takes a session token first.
imds_token=$(curl -sf -X PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
region=$(curl -sf -H "X-aws-ec2-metadata-token: $imds_token" \
  http://169.254.169.254/latest/meta-data/placement/region)

# One line per parameter, as NAME<tab>VALUE, mapped onto the variables application.yaml
# reads. The values never pass through a variable that could be echoed or traced.
echo "Reading /pillfacts/* from Parameter Store"
install -d -m 700 /etc/pillfacts
umask 077
tmp=$(mktemp /etc/pillfacts/backend.env.XXXXXX)
trap 'rm -f "$tmp"' EXIT
aws ssm get-parameters --region "$region" --with-decryption \
  --names /pillfacts/db-url /pillfacts/db-username /pillfacts/db-password /pillfacts/openfda-api-key \
  --query 'Parameters[].[Name,Value]' --output text |
  awk -F '\t' '
    { value = substr($0, length($1) + 2) }
    $1 == "/pillfacts/db-url"          { print "PILLFACTS_DB_URL=" value; n++ }
    $1 == "/pillfacts/db-username"     { print "PILLFACTS_DB_USERNAME=" value; n++ }
    $1 == "/pillfacts/db-password"     { print "PILLFACTS_DB_PASSWORD=" value; n++ }
    $1 == "/pillfacts/openfda-api-key" { print "PILLFACTS_OPENFDA_API_KEY=" value; n++ }
    END { if (n != 4) { print "expected 4 parameters under /pillfacts, found " n+0 > "/dev/stderr"; exit 1 } }
  ' > "$tmp"
mv "$tmp" "$ENV_FILE"

echo "Pulling $IMAGE"
docker pull --quiet "$IMAGE"

# The old container goes first: a t3.micro has no room for two JVMs at once.
echo "Replacing $NAME"
docker rm -f "$NAME" >/dev/null 2>&1 || true

# The tuning for a 1GB box (ADR-0009), which the image's own defaults don't assume:
# - a 768m container leaves the rest to Docker and the OS, and the heap 60% of that;
# - the serial collector and small thread stacks, because one core and 20 threads
#   don't need more;
# - a pool of 4 that drains to nothing after a minute idle. Hikari pings the
#   connections it keeps, and a pinged Neon compute never scales to zero, which spends
#   the free tier's compute hours on doing nothing.
docker run -d --name "$NAME" \
  --restart unless-stopped \
  -p 80:8080 \
  --memory 768m \
  --env-file "$ENV_FILE" \
  -e JAVA_TOOL_OPTIONS='-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -Xss512k' \
  -e SERVER_TOMCAT_THREADS_MAX=20 \
  -e SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=4 \
  -e SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=0 \
  -e SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT=60000 \
  "$IMAGE" >/dev/null

# Any HTTP status counts as answering, since nothing is mapped at /. Spring, Flyway and a
# Neon compute waking from zero take a while on a t3.micro.
echo "Waiting for port 80 to answer"
for _ in $(seq 1 90); do
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost/ || true)
  if [[ "$status" != "000" ]]; then
    echo "$NAME is answering on port 80 ($IMAGE)"
    docker image prune -f >/dev/null
    exit 0
  fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != "true" ]]; then
    break
  fi
  sleep 2
done

echo "$NAME did not answer on port 80. Its last log lines:" >&2
docker logs --tail 50 "$NAME" >&2
exit 1
