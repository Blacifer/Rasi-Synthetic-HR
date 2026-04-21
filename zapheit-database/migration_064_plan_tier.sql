-- migration_064_plan_tier.sql
-- Adds plan_tier column to organizations and a gateway_usage table for
-- monthly request tracking. Idempotent — safe to run multiple times.

-- 1. Ensure plan column exists (most orgs have it already; this is a safety net)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- 2. Add plan_tier column for richer plan metadata
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_tier JSONB DEFAULT '{}'::jsonb;

-- 3. Add grace_period_ends_at for 14-day grace on limit breaches
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- 4. Ensure gateway_usage table exists for monthly quota tracking
CREATE TABLE IF NOT EXISTS gateway_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,              -- 'YYYY-MM'
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, month)
);

-- 5. RLS for gateway_usage
ALTER TABLE gateway_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "gateway_usage_select" ON gateway_usage
    FOR SELECT USING (
      org_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Index for quota lookups
CREATE INDEX IF NOT EXISTS idx_gateway_usage_org_month
  ON gateway_usage (org_id, month);

-- 7. Comment
COMMENT ON TABLE gateway_usage IS
  'Monthly gateway request counts per org. Used by planGate for quota enforcement.';
