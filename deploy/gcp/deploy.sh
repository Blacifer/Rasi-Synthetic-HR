#!/usr/bin/env bash
# deploy/gcp/deploy.sh
# First-time GCP setup script for Zapheit (synthetic-hr-api + synthetic-hr-runtime)
# Run once after completing the manual steps in README.md
#
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export REGION=asia-south1
#   bash deploy/gcp/deploy.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID env var first}"
REGION="${REGION:-asia-south1}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/rasi"
COMMIT_SHA=$(git rev-parse --short HEAD)

echo ""
echo "=== Zapheit GCP First-Time Deploy ==="
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Registry: ${REGISTRY}"
echo "  Commit  : ${COMMIT_SHA}"
echo ""

# ── Step 1: Ensure APIs are enabled ──────────────────────────────────────────
echo "[1/6] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

# ── Step 2: Create Artifact Registry repo (idempotent) ───────────────────────
echo "[2/6] Creating Artifact Registry repository 'rasi'..."
gcloud artifacts repositories create rasi \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Zapheit container images" \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "  (already exists — skipping)"

# ── Step 3: Configure Docker auth ────────────────────────────────────────────
echo "[3/6] Configuring Docker credentials for Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── Step 4: Build & push synthetic-hr-api ────────────────────────────────────
echo "[4/6] Building and pushing synthetic-hr-api..."
docker build \
  -t "${REGISTRY}/synthetic-hr-api:${COMMIT_SHA}" \
  -t "${REGISTRY}/synthetic-hr-api:latest" \
  ./synthetic-hr-api

docker push --all-tags "${REGISTRY}/synthetic-hr-api"

# ── Step 5: Build & push synthetic-hr-runtime ────────────────────────────────
echo "[5/6] Building and pushing synthetic-hr-runtime..."
docker build \
  -t "${REGISTRY}/synthetic-hr-runtime:${COMMIT_SHA}" \
  -t "${REGISTRY}/synthetic-hr-runtime:latest" \
  ./synthetic-hr-runtime

docker push --all-tags "${REGISTRY}/synthetic-hr-runtime"

# ── Step 6: Deploy to Cloud Run ───────────────────────────────────────────────
echo "[6/6] Deploying services to Cloud Run..."

echo "  Deploying synthetic-hr-api..."
gcloud run deploy synthetic-hr-api \
  --image="${REGISTRY}/synthetic-hr-api:${COMMIT_SHA}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=60 \
  --set-secrets="NODE_ENV=NODE_ENV:latest,\
SUPABASE_URL=SUPABASE_URL:latest,\
SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,\
SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,\
JWT_SECRET=JWT_SECRET:latest,\
FRONTEND_URL=FRONTEND_URL:latest,\
API_URL=API_URL:latest,\
OPENAI_API_KEY=OPENAI_API_KEY:latest,\
DATABASE_URL=DATABASE_URL:latest,\
INTEGRATIONS_ENCRYPTION_KEY=INTEGRATIONS_ENCRYPTION_KEY:latest" \
  --project="${PROJECT_ID}"

echo "  Deploying synthetic-hr-runtime..."
gcloud run deploy synthetic-hr-runtime \
  --image="${REGISTRY}/synthetic-hr-runtime:${COMMIT_SHA}" \
  --region="${REGION}" \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=3002 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=3 \
  --timeout=3600 \
  --set-secrets="SYNTHETICHR_CONTROL_PLANE_URL=SYNTHETICHR_CONTROL_PLANE_URL:latest,\
SYNTHETICHR_API_KEY=SYNTHETICHR_API_KEY:latest,\
SYNTHETICHR_RUNTIME_ID=SYNTHETICHR_RUNTIME_ID:latest,\
SYNTHETICHR_MODEL=SYNTHETICHR_MODEL:latest" \
  --project="${PROJECT_ID}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Deploy complete! ==="
echo ""
echo "API URL:"
gcloud run services describe synthetic-hr-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)"
echo ""
echo "Next: update FRONTEND_URL and API_URL secrets if the URLs changed."
echo "Then update your Vercel environment variable VITE_API_URL to match the API URL above."
