#!/bin/bash
set -e

echo "==> Social Media App Setup"

# Check .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — review and update values before proceeding."
fi

# Start infrastructure
echo "==> Starting Docker services..."
docker compose up -d db redis minio minio-init

# Wait for PostgreSQL
echo "==> Waiting for PostgreSQL..."
until docker compose exec db pg_isready -U "${POSTGRES_USER:-letstweet}" > /dev/null 2>&1; do sleep 1; done

# Run migrations
echo "==> Running database migrations..."
DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2-) npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

echo ""
echo "==> Setup complete!"
echo "    Run: npm run dev"
echo "    App: http://localhost:3000"
echo "    MinIO: http://localhost:9001 (minioadmin / minioadmin)"
echo "    pgAdmin: http://localhost:5050"
