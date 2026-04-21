-- migration_067_enterprise_features.sql
-- P4-02: data residency, P4-03: IP allowlisting, P4-09: shadow AI detection

-- ── Data residency ────────────────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_region text NOT NULL DEFAULT 'in-south1';
CREATE INDEX IF NOT EXISTS organizations_data_region_idx ON organizations (data_region);

-- ── IP allowlisting ───────────────────────────────────────────────────────────
-- Stored as JSONB array of CIDR strings, e.g. ["203.0.113.0/24","10.0.0.1/32"]
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ip_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Shadow AI detection ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shadow_ai_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  source_ip       text,
  user_agent      text,
  request_url     text NOT NULL,
  provider        text NOT NULL,          -- openai | anthropic | gemini | other
  request_method  text NOT NULL DEFAULT 'POST',
  request_size    integer,
  blocked         boolean NOT NULL DEFAULT false,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS shadow_ai_events_org_idx   ON shadow_ai_events (organization_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS shadow_ai_events_prov_idx  ON shadow_ai_events (organization_id, provider);

ALTER TABLE shadow_ai_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members read shadow ai events" ON shadow_ai_events;
CREATE POLICY "org members read shadow ai events"
  ON shadow_ai_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
