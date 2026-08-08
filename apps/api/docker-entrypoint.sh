#!/bin/sh
set -e

# Applying migrations at boot keeps the deploy self-contained and works on every hosting tier
# (Render's preDeployCommand, for instance, is paid-plan only). `prisma migrate deploy` takes a
# Postgres advisory lock, so several instances starting at once serialise safely rather than
# racing each other.
#
# Set RUN_MIGRATIONS_ON_BOOT=false once migrations are run out of band — never run both.
if [ "${RUN_MIGRATIONS_ON_BOOT:-true}" = "true" ]; then
  echo "==> prisma migrate deploy"
  prisma migrate deploy --schema ./prisma/schema.prisma
fi

exec "$@"
