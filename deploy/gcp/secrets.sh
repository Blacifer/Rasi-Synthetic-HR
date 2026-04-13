#!/usr/bin/env bash
# deploy/gcp/secrets.sh
# Populate all Secret Manager secrets for Zapheit production.
#
# IMPORTANT: Never commit this file with real values.
# Fill in the values below locally, run once, then leave as placeholders.
#
# Usage:
#   export PROJECT_ID=rasisynthetichr
#   bash deploy/gcp/secrets.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID env var first}"

secret() {
  local NAME="$1"
  local VALUE="$2"
  if [ -z "${VALUE}" ] || [[ "${VALUE}" == COPY_FROM_* ]] || [[ "${VALUE}" == FILL_* ]]; then
    echo "  [SKIP] ${NAME} — placeholder not filled, skipping"
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
secret NODE_ENV                     "production"
secret PORT                         "3001"

# ── Supabase ──────────────────────────────────────────────────────────────────
secret SUPABASE_URL                 "COPY_FROM_RAILWAY"
secret SUPABASE_ANON_KEY            "COPY_FROM_RAILWAY"
secret SUPABASE_SERVICE_KEY         "COPY_FROM_RAILWAY"
secret JWT_SECRET                   "COPY_FROM_RAILWAY"
secret DATABASE_URL                 "COPY_FROM_RAILWAY"

# ── URLs ──────────────────────────────────────────────────────────────────────
secret FRONTEND_URL                 "COPY_FROM_RAILWAY"
secret API_URL                      "COPY_FROM_RAILWAY"
secret CORS_ALLOWED_ORIGINS         "COPY_FROM_RAILWAY"

# ── Encryption (CRITICAL: copy exact values from Railway — do NOT change) ─────
secret INTEGRATIONS_ENCRYPTION_KEY  "COPY_FROM_RAILWAY"
secret ERASURE_SIGNING_SALT         "COPY_FROM_RAILWAY"

# ── AI Providers ──────────────────────────────────────────────────────────────
secret OPENAI_API_KEY               "COPY_FROM_RAILWAY"
secret ANTHROPIC_API_KEY            "COPY_FROM_RAILWAY"
secret RASI_OPENAI_API_KEY          "COPY_FROM_RAILWAY"
secret RASI_ANTHROPIC_API_KEY       "COPY_FROM_RAILWAY"
secret RASI_OPENROUTER_API_KEY      "COPY_FROM_RAILWAY"

# ── Email ─────────────────────────────────────────────────────────────────────
secret EMAIL_PROVIDER               "COPY_FROM_RAILWAY"
secret EMAIL_FROM                   "COPY_FROM_RAILWAY"
secret ALERT_EMAIL_TO               "COPY_FROM_RAILWAY"
secret RESEND_API_KEY               "COPY_FROM_RAILWAY"

# ── Payments (Cashfree) ───────────────────────────────────────────────────────
secret CASHFREE_CLIENT_ID           "COPY_FROM_CASHFREE_DASHBOARD"
secret CASHFREE_CLIENT_SECRET       "COPY_FROM_CASHFREE_DASHBOARD"
secret CASHFREE_API_VERSION         "2023-08-01"
secret CASHFREE_ENVIRONMENT         "production"
# secret CASHFREE_WEBHOOK_SECRET    "COPY_FROM_CASHFREE_DASHBOARD"

# ── OAuth Integrations ────────────────────────────────────────────────────────
secret GOOGLE_CLIENT_ID             "COPY_FROM_RAILWAY"
secret GOOGLE_CLIENT_SECRET         "COPY_FROM_RAILWAY"
secret SLACK_CLIENT_ID              "COPY_FROM_RAILWAY"
secret SLACK_CLIENT_SECRET          "COPY_FROM_RAILWAY"
secret SLACK_SIGNING_SECRET         "COPY_FROM_RAILWAY"
secret MICROSOFT_CLIENT_ID          "COPY_FROM_RAILWAY"
secret MICROSOFT_CLIENT_SECRET      "COPY_FROM_RAILWAY"
secret ZOHO_CLIENT_ID               "COPY_FROM_RAILWAY"
secret ZOHO_CLIENT_SECRET           "COPY_FROM_RAILWAY"
secret LINKEDIN_CLIENT_ID           "COPY_FROM_RAILWAY"
secret LINKEDIN_CLIENT_SECRET       "COPY_FROM_RAILWAY"
secret SALESFORCE_CLIENT_ID         "COPY_FROM_RAILWAY"
secret SALESFORCE_CLIENT_SECRET     "COPY_FROM_RAILWAY"
secret INTERCOM_CLIENT_ID           "COPY_FROM_RAILWAY"
secret INTERCOM_CLIENT_SECRET       "COPY_FROM_RAILWAY"
secret QUICKBOOKS_CLIENT_ID         "COPY_FROM_RAILWAY"
secret QUICKBOOKS_CLIENT_SECRET     "COPY_FROM_RAILWAY"
secret DEEL_CLIENT_ID               "COPY_FROM_RAILWAY"
secret DEEL_CLIENT_SECRET           "COPY_FROM_RAILWAY"
secret GUSTO_CLIENT_ID              "COPY_FROM_RAILWAY"
secret GUSTO_CLIENT_SECRET          "COPY_FROM_RAILWAY"
secret FLOCK_CLIENT_ID              "COPY_FROM_RAILWAY"
secret FLOCK_CLIENT_SECRET          "COPY_FROM_RAILWAY"
secret HUBSPOT_CLIENT_ID            "COPY_FROM_RAILWAY"
secret HUBSPOT_CLIENT_SECRET        "COPY_FROM_RAILWAY"

# ── Feature Flags ─────────────────────────────────────────────────────────────
secret CONNECTORS_ENABLED           "COPY_FROM_RAILWAY"
secret CROSS_BORDER_PII_MASKING     "COPY_FROM_RAILWAY"
secret SCHEMA_COMPAT_STRICT_OPTIONAL "COPY_FROM_RAILWAY"
secret REDTEAM_INTERVAL_MINUTES     "COPY_FROM_RAILWAY"
secret RECRUITMENT_SCORING_MODEL    "COPY_FROM_RAILWAY"

# ── Observability ─────────────────────────────────────────────────────────────
secret OTEL_ENABLED                 "COPY_FROM_RAILWAY"
secret OTEL_EXPORTER_OTLP_ENDPOINT  "COPY_FROM_RAILWAY"
secret OTEL_EXPORTER_OTLP_TIMEOUT   "COPY_FROM_RAILWAY"
secret OTEL_EXPORTER_OTLP_INSECURE  "COPY_FROM_RAILWAY"
secret OTEL_TRACES_EXPORTER         "COPY_FROM_RAILWAY"
secret OTEL_METRICS_EXPORTER        "COPY_FROM_RAILWAY"

# ── Runtime worker (fill AFTER first API deploy) ──────────────────────────────
secret SYNTHETICHR_CONTROL_PLANE_URL "FILL_AFTER_FIRST_DEPLOY"
secret SYNTHETICHR_API_KEY           "FILL_AFTER_FIRST_DEPLOY"
secret SYNTHETICHR_RUNTIME_ID        "FILL_AFTER_FIRST_DEPLOY"
secret SYNTHETICHR_MODEL             "gpt-4o"

echo ""
echo "=== Secrets setup complete ==="
