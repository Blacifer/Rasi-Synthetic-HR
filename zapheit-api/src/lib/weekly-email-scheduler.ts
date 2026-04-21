/**
 * Weekly value email — sent every Monday at 9am IST (3:30am UTC).
 *
 * For each org with at least one active user, sends a summary:
 *   "We caught X problems before they reached your customers this week."
 *
 * Env: WEEKLY_EMAIL_ENABLED=true to activate.
 */

import { logger } from './logger';
import { supabaseRestAsService, eq } from './supabase-rest';
import { sendTransactionalEmail } from './email';
import { weeklyValueEmail } from './email-templates';
import { usdToInr } from './currency';

let timer: NodeJS.Timeout | null = null;

const MONDAY = 1; // getDay()
const TARGET_HOUR_UTC = 3;
const TARGET_MINUTE_UTC = 30;
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

function isSendTime(): boolean {
  const now = new Date();
  return (
    now.getUTCDay() === MONDAY &&
    now.getUTCHours() === TARGET_HOUR_UTC &&
    now.getUTCMinutes() === TARGET_MINUTE_UTC
  );
}

async function sendWeeklyEmails(): Promise<void> {
  logger.info('weekly-email: starting send run');

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';

  try {
    const orgs = (await supabaseRestAsService('organizations', new URLSearchParams('select=id,name&limit=500'))) as Array<{ id: string; name: string }>;
    for (const org of orgs || []) {
      try {
        await sendOrgWeeklyEmail(org.id, org.name, weekAgo, frontendUrl);
      } catch (err: any) {
        logger.warn('weekly-email: org send failed', { orgId: org.id, err: err?.message });
      }
    }
  } catch (err: any) {
    logger.warn('weekly-email: failed to fetch orgs', { err: err?.message });
  }

  logger.info('weekly-email: run complete');
}

async function sendOrgWeeklyEmail(orgId: string, orgName: string, since: string, frontendUrl: string): Promise<void> {
  // Fetch metrics in parallel
  const [usersRows, incidentsRows, approvalsRows, costRows] = await Promise.all([
    supabaseRestAsService('users', new URLSearchParams(`organization_id=eq.${orgId}&select=email&limit=50`)) as Promise<Array<{ email: string }>>,
    supabaseRestAsService('incidents', new URLSearchParams(`organization_id=eq.${orgId}&created_at=gte.${since}&select=id`)) as Promise<Array<{ id: string }>>,
    supabaseRestAsService('approval_requests', new URLSearchParams(`organization_id=eq.${orgId}&status=eq.pending&select=id`)) as Promise<Array<{ id: string }>>,
    supabaseRestAsService('cost_tracking', new URLSearchParams(`organization_id=eq.${orgId}&created_at=gte.${since}&select=cost_usd`)) as Promise<Array<{ cost_usd: number }>>,
  ]);

  const recipients = (usersRows || []).map((u) => u.email).filter(Boolean);
  if (recipients.length === 0) return;

  const incidentsCaught = (incidentsRows || []).length;
  const approvalsPending = (approvalsRows || []).length;
  const totalUsd = (costRows || []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const estimatedSpend = totalUsd > 0 ? `₹${Math.round(usdToInr(totalUsd)).toLocaleString('en-IN')}` : '₹0';

  // Estimate messages from cost (800 tokens/message, ~$0.002/1k tokens average)
  const estimatedMessages = totalUsd > 0 ? Math.round(totalUsd / 0.002 / 800) * 800 : 0;

  const dashboardUrl = `${frontendUrl}/dashboard`;

  await Promise.allSettled(recipients.map((email) => {
    const tmpl = weeklyValueEmail({
      recipientEmail: email,
      orgName,
      weeklyStats: { messagesSent: estimatedMessages, incidentsCaught, approvalsPending, estimatedSpend },
      dashboardUrl,
    });
    return sendTransactionalEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
  }));

  logger.info('weekly-email: org sent', { orgId, recipients: recipients.length, incidentsCaught });
}

export function startWeeklyEmailScheduler(): void {
  if (process.env.WEEKLY_EMAIL_ENABLED !== 'true') return;
  if (timer) return;

  let lastSentMinute = '';

  timer = setInterval(async () => {
    if (!isSendTime()) return;
    const minuteKey = new Date().toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:MM'
    if (lastSentMinute === minuteKey) return; // don't double-send within the same minute
    lastSentMinute = minuteKey;
    await sendWeeklyEmails().catch((err: any) =>
      logger.warn('weekly-email: scheduler error', { err: err?.message }),
    );
  }, CHECK_INTERVAL_MS).unref();

  logger.info('weekly-email: scheduler started (fires Monday 09:00 IST)');
}

export function stopWeeklyEmailScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
