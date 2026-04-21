/**
 * Zapheit email templates.
 *
 * Every email follows the same card design:
 *   - Dark header with Zapheit wordmark
 *   - White card body with one headline, one body paragraph
 *   - Single primary CTA button
 *   - Footer with help link
 *
 * Plain-text companion is always generated from the inputs.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const BRAND_COLOR = '#06b6d4'; // cyan-500
const BUTTON_STYLE = `display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;`;

function card(opts: {
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  extra?: string;
}): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<p style="margin:24px 0 0;"><a href="${opts.ctaUrl}" style="${BUTTON_STYLE}">${opts.ctaLabel}</a></p>`
    : '';

  const fallbackLink = opts.ctaUrl
    ? `<p style="margin-top:16px;font-size:12px;color:#6b7280;">Button not working? Copy this link: <a href="${opts.ctaUrl}" style="color:${BRAND_COLOR};">${opts.ctaUrl}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 32px;">
          <span style="font-size:20px;font-weight:700;color:${BRAND_COLOR};">Zapheit</span>
          <span style="font-size:11px;color:#475569;margin-left:8px;">AI Workforce Manager</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">${opts.headline}</h1>
          <p style="margin:0 0 0;font-size:15px;line-height:1.6;color:#374151;">${opts.body}</p>
          ${cta}
          ${fallbackLink}
          ${opts.extra ? `<div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px;font-size:13px;color:#6b7280;">${opts.extra}</div>` : ''}
          <hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            This email was sent by Zapheit. Questions? Reply to this email or visit
            <a href="https://zapheit.com" style="color:${BRAND_COLOR};">zapheit.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function inviteSentEmail(opts: {
  inviteLink: string;
  role: string;
  orgName: string;
  message?: string;
}): EmailTemplate {
  const roleLabel = opts.role === 'admin' ? 'Admin' : opts.role === 'manager' ? 'Manager' : 'Viewer';
  return {
    subject: `You've been invited to join ${opts.orgName} on Zapheit`,
    html: card({
      headline: `You're invited to ${opts.orgName}`,
      body: `Someone from <strong>${opts.orgName}</strong> has added you to their Zapheit workspace as a <strong>${roleLabel}</strong>. Click below to accept — the invite expires in 7 days.`,
      ctaLabel: 'Accept Invitation',
      ctaUrl: opts.inviteLink,
      extra: opts.message ? `Message from your team: "${opts.message}"` : undefined,
    }),
    text: `You've been invited to ${opts.orgName} on Zapheit as ${roleLabel}.\n\nAccept here: ${opts.inviteLink}\n\nThis invite expires in 7 days.`,
  };
}

export function inviteAcceptedEmail(opts: {
  adminEmail: string;
  memberEmail: string;
  orgName: string;
  dashboardUrl: string;
}): EmailTemplate {
  return {
    subject: `${opts.memberEmail} has joined your team on Zapheit`,
    html: card({
      headline: 'A new team member joined',
      body: `<strong>${opts.memberEmail}</strong> has accepted their invitation and joined <strong>${opts.orgName}</strong> on Zapheit.`,
      ctaLabel: 'View Your Team',
      ctaUrl: opts.dashboardUrl,
    }),
    text: `${opts.memberEmail} has accepted their invitation and joined ${opts.orgName} on Zapheit.\n\nView your team: ${opts.dashboardUrl}`,
  };
}

export function approvalRequestedEmail(opts: {
  approverEmail: string;
  agentName: string;
  actionDescription: string;
  approvalUrl: string;
  autoBlockIn?: string;
}): EmailTemplate {
  const autoBlockNote = opts.autoBlockIn
    ? `This request will be <strong>automatically blocked</strong> if no response is received within ${opts.autoBlockIn}.`
    : 'Please review this request at your earliest convenience.';

  return {
    subject: `Action needed: ${opts.agentName} is waiting for your approval`,
    html: card({
      headline: `${opts.agentName} wants to do something`,
      body: `Your AI assistant <strong>${opts.agentName}</strong> has requested an action that requires human review:<br><br><em>${opts.actionDescription}</em><br><br>${autoBlockNote}`,
      ctaLabel: 'Review & Decide',
      ctaUrl: opts.approvalUrl,
    }),
    text: `${opts.agentName} has requested an action that requires your approval.\n\nAction: ${opts.actionDescription}\n\nReview here: ${opts.approvalUrl}`,
  };
}

export function approvalResolvedEmail(opts: {
  requesterEmail: string;
  agentName: string;
  decision: 'approved' | 'rejected';
  actionDescription: string;
  resolvedBy: string;
  dashboardUrl: string;
}): EmailTemplate {
  const verb = opts.decision === 'approved' ? 'approved ✅' : 'blocked ❌';
  return {
    subject: `Approval ${opts.decision}: ${opts.agentName}`,
    html: card({
      headline: `Request ${verb}`,
      body: `The request from <strong>${opts.agentName}</strong> was <strong>${verb}</strong> by ${opts.resolvedBy}.<br><br><em>${opts.actionDescription}</em>`,
      ctaLabel: 'View Activity History',
      ctaUrl: opts.dashboardUrl,
    }),
    text: `The request from ${opts.agentName} was ${verb} by ${opts.resolvedBy}.\n\nAction: ${opts.actionDescription}\n\nView history: ${opts.dashboardUrl}`,
  };
}

export function incidentFlaggedEmail(opts: {
  recipientEmail: string;
  agentName: string;
  incidentTitle: string;
  severity: string;
  description: string;
  incidentUrl: string;
}): EmailTemplate {
  const severityLabel = opts.severity === 'critical' ? '🔴 Critical' : opts.severity === 'high' ? '🟠 High' : '🟡 Medium';
  return {
    subject: `${severityLabel} safety alert: ${opts.agentName}`,
    html: card({
      headline: `Problem detected with ${opts.agentName}`,
      body: `Zapheit caught a <strong>${opts.severity}</strong> issue before it reached your customers:<br><br><strong>${opts.incidentTitle}</strong><br>${opts.description}`,
      ctaLabel: 'View Alert',
      ctaUrl: opts.incidentUrl,
    }),
    text: `Zapheit caught a ${opts.severity} issue with ${opts.agentName}.\n\n${opts.incidentTitle}\n${opts.description}\n\nView alert: ${opts.incidentUrl}`,
  };
}

export function weeklyValueEmail(opts: {
  recipientEmail: string;
  orgName: string;
  weeklyStats: {
    messagesSent: number;
    incidentsCaught: number;
    approvalsPending: number;
    estimatedSpend: string;
  };
  dashboardUrl: string;
}): EmailTemplate {
  const { messagesSent, incidentsCaught, approvalsPending, estimatedSpend } = opts.weeklyStats;
  const heroLine = incidentsCaught > 0
    ? `We caught <strong>${incidentsCaught} problem${incidentsCaught !== 1 ? 's' : ''}</strong> before they reached your customers this week.`
    : `Your AI workforce had a clean week — no problems detected.`;

  return {
    subject: `Your AI workforce this week — ${opts.orgName}`,
    html: card({
      headline: `This week at ${opts.orgName}`,
      body: `${heroLine}<br><br>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#374151;font-size:14px;">Messages sent</td>
            <td style="padding:8px 0;color:#111827;font-weight:600;font-size:14px;text-align:right;">${messagesSent.toLocaleString('en-IN')}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:8px 0;color:#374151;font-size:14px;">Problems caught</td>
            <td style="padding:8px 0;color:${incidentsCaught > 0 ? '#059669' : '#111827'};font-weight:600;font-size:14px;text-align:right;">${incidentsCaught}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:8px 0;color:#374151;font-size:14px;">Approvals pending</td>
            <td style="padding:8px 0;color:${approvalsPending > 0 ? '#d97706' : '#111827'};font-weight:600;font-size:14px;text-align:right;">${approvalsPending}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:8px 0;color:#374151;font-size:14px;">Estimated spend</td>
            <td style="padding:8px 0;color:#111827;font-weight:600;font-size:14px;text-align:right;">${estimatedSpend}</td>
          </tr>
        </table>`,
      ctaLabel: 'View Full Dashboard',
      ctaUrl: opts.dashboardUrl,
    }),
    text: `Weekly AI workforce report for ${opts.orgName}.\n\nMessages sent: ${messagesSent}\nProblems caught: ${incidentsCaught}\nApprovals pending: ${approvalsPending}\nEstimated spend: ${estimatedSpend}\n\nView dashboard: ${opts.dashboardUrl}`,
  };
}
