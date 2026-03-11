# Internal Connectors (Support / Sales / IT)

This adds “connector actions” that create real records **inside** the app (no external tools required):

- **Support**: `support.ticket.create` → `support_tickets`
- **Sales**: `sales.lead.create` → `sales_leads`
- **IT**: `it.access_request.create` → `it_access_requests`

All of these run through the same control-plane flow:

**Playbooks → Job (pending approval) → Approve → Runtime executes `connector_action` → Audit + Work Item created**

## 1) Database migration

Apply: `synthetic-hr-database/migration_006_internal_work_items.sql`

## 2) API endpoints (user auth)

- `GET /api/work-items/support-tickets`
- `GET /api/work-items/sales-leads`
- `GET /api/work-items/access-requests`

Permissions:
- `workitems.read`
- `workitems.manage`

## 3) Runtime execution endpoint (runtime auth)

Runtime uses:
- `POST /api/runtimes/actions/execute`

This writes:
- the target work item row
- an `agent_action_runs` record for audit and traceability

## 4) UI

- **Playbooks**: filter packs (Support / Sales / IT) and submit connector actions for approval.
- **Jobs & Approvals**: approve connector actions and review output.
- **Work Items**: view created tickets/leads/access requests.

