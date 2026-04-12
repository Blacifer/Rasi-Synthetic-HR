#!/usr/bin/env bash
# deploy/gcp/secrets.sh
# Populate all Secret Manager secrets for Zapheit production.
# Edit the values below, then run once:
#   export PROJECT_ID=rasisynthetichr
#   bash deploy/gcp/secrets.sh
#
# Safe to re-run — adds a new secret version if the secret already exists.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID env var first}"

# Helper: creates secret if missing, then adds a new version
secret() {
  local NAME="$1"
  local VALUE="$2"
  if [ -z "${VALUE}" ]; then
    echo "  [SKIP] ${NAME} — value is empty, skipping"
    return
  fi
  gcloud secrets describe "${NAME}" --project="${PROJECT_ID}" &>/dev/null \
    || gcloud secrets create "${NAME}" \
         --replication-policy=automatic \
         --project="${PROJECT_ID}"
  echo -n "${VALUE}" | gcloud secrets versions add "${NAME}" \
    --data-file=- --project="${PROJECT_ID}"
  echo "  [OK]   ${NAME}"
}

echo ""
echo "=== Zapheit Secret Manager Setup ==="
echo "  Project: ${PROJECT_ID}"
echo ""

# ── Core ──────────────────────────────────────────────────────────────────────
secret NODE_ENV            "production"

# ── Supabase ──────────────────────────────────────────────────────────────────
# Get these from: Supabase Dashboard → Project Settings → API
secret SUPABASE_URL        "https://XXXX.supabase.co"
secret SUPABASE_ANON_KEY   "eyJ..."
secret SUPABASE_SERVICE_KEY "eyJ..."

# Get from: Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret
secret JWT_SECRET          "your-supabase-jwt-secret"

# Get from: Supabase Dashboard → Project Settings → Database → Connection string (URI mode)
secret DATABASE_URL        "postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres"

# ── URLs (update API_URL after first deploy) ──────────────────────────────────
secret FRONTEND_URL        "https://app.zapheit.com"
secret API_URL             "https://synthetic-hr-api-XXXX-el.a.run.app"  # update after first deploy

# ── Encryption ────────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
secret INTEGRATIONS_ENCRYPTION_KEY "$(openssl rand -hex 32)"

# Generate with: openssl rand -hex 16
secret ERASURE_SIGNING_SALT        "$(openssl rand -hex 16)"

# ── AI Providers ──────────────────────────────────────────────────────────────
# Required: at least OpenAI
secret OPENAI_API_KEY      "sk-..."

# Optional but recommended
secret ANTHROPIC_API_KEY   "sk-ant-..."
# secret OPENROUTER_API_KEY  "sk-or-..."

# ── Email (Resend) ────────────────────────────────────────────────────────────
# Sign up at resend.com — free tier covers transactional email
secret RESEND_API_KEY      "re_..."
secret EMAIL_FROM          "no-reply@zapheit.com"

# ── Runtime worker ────────────────────────────────────────────────────────────
# Fill these AFTER first deploy of the API and registering a runtime in the dashboard
secret SYNTHETICHR_CONTROL_PLANE_URL "https://synthetic-hr-api-XXXX-el.a.run.app"
secret SYNTHETICHR_API_KEY           "your-runtime-api-key"
secret SYNTHETICHR_RUNTIME_ID        "your-runtime-uuid"
secret SYNTHETICHR_MODEL             "gpt-4o"

echo ""
echo "=== Secrets setup complete ==="
echo ""
echo "IMPORTANT: Edit this file first and replace all placeholder values!"
echo "If you see secrets with placeholder values above, run this script again after editing."
