/**
 * PostHog analytics — tracks product-critical events for growth and retention.
 * All calls are fire-and-forget; failures are silently swallowed so analytics
 * can never break the product.
 *
 * Key events (per plan P5-02):
 *   onboarding_completed, first_agent_created, approval_responded,
 *   feature_adopted, plan_upgraded, demo_entered, invite_sent
 */
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics(): void {
  // Read env vars lazily so this file is safe to import in Jest (no import.meta at module level)
  const key = (import.meta as any).env?.VITE_POSTHOG_KEY as string | undefined;
  const host = ((import.meta as any).env?.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com';
  if (initialized || !key) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    disable_session_recording: false,
  });
  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized) return;
  try { posthog.identify(userId, traits); } catch {
    // Analytics must never interrupt product flows.
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try { posthog.capture(event, properties); } catch {
    // Analytics must never interrupt product flows.
  }
}

export function resetAnalytics(): void {
  if (!initialized) return;
  try { posthog.reset(); } catch {
    // Analytics must never interrupt product flows.
  }
}

// ── Typed event helpers ────────────────────────────────────────────────────

export const analytics = {
  onboardingCompleted: (stepCount: number) =>
    trackEvent('onboarding_completed', { step_count: stepCount }),

  firstAgentCreated: (agentType: string, templateId?: string) =>
    trackEvent('first_agent_created', { agent_type: agentType, template_id: templateId }),

  agentCreated: (agentType: string, templateId?: string) =>
    trackEvent('agent_created', { agent_type: agentType, template_id: templateId }),

  approvalResponded: (action: 'approved' | 'rejected', responseTimeSec: number, role: string) =>
    trackEvent('approval_responded', { action, response_time_sec: responseTimeSec, role }),

  featureAdopted: (feature: string, role: string) =>
    trackEvent('feature_adopted', { feature, role }),

  planUpgraded: (fromPlan: string, toPlan: string) =>
    trackEvent('plan_upgraded', { from_plan: fromPlan, to_plan: toPlan }),

  demoEntered: () =>
    trackEvent('demo_entered'),

  inviteSent: (role: string) =>
    trackEvent('invite_sent', { role }),

  checkoutStarted: (plan: string, billing: 'monthly' | 'annual') =>
    trackEvent('checkout_started', { plan, billing }),

  killSwitchActivated: (agentId: string, level: number) =>
    trackEvent('kill_switch_activated', { agent_id: agentId, level }),
};
