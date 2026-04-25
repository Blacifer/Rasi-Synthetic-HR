-- migration_072_session_recording.sql
-- P3-12: Session recording + configurable retention policy per org

-- Add dedicated columns to organizations for performance and cron clarity.
-- Values are also mirrored in the settings JSONB for API convenience.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS session_recording_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conversation_retention_days integer NOT NULL DEFAULT 90
    CHECK (conversation_retention_days IN (30, 90, 365));

-- Index used by the nightly retention worker
CREATE INDEX IF NOT EXISTS idx_orgs_retention
  ON organizations (conversation_retention_days)
  WHERE session_recording_enabled = true;

-- Policy: conversations older than the org's retention window are eligible for deletion.
-- The worker queries:
--   DELETE FROM conversations
--   WHERE organization_id = $orgId
--     AND created_at < NOW() - INTERVAL '1 day' * retention_days

COMMENT ON COLUMN organizations.session_recording_enabled IS
  'When false, gateway does not persist message content — only metadata is stored.';
COMMENT ON COLUMN organizations.conversation_retention_days IS
  '30 = Free tier max, 90 = Pro default, 365 = Business/Enterprise. Enforced by nightly TTL worker.';
