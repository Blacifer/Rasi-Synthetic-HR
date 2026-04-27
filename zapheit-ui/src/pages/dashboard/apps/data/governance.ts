export type GovTier = 'observe' | 'controlled' | 'full';

export const GOVERNANCE_TIERS: Record<string, GovTier> = {
  // Observe only — read-only adapters or sensitive financial/legal data
  'google-analytics': 'observe', 'mixpanel': 'observe', 'tableau': 'observe',
  'metabase': 'observe', 'looker': 'observe', 'powerbi': 'observe',
  'epfo': 'observe', 'mca21': 'observe', 'gstn': 'observe',
  'aadhaar': 'observe', 'digilocker': 'observe',
  // Full access — low-risk collaboration tools
  'slack': 'full', 'notion': 'full', 'google-workspace': 'full',
  'microsoft-365': 'full', 'zoom': 'full', 'meet': 'full',
  'figma': 'full', 'miro': 'full', 'loom': 'full',
  // Controlled write — everything else with write actions
  'greythr': 'controlled', 'tally': 'controlled', 'naukri': 'controlled',
  'cashfree': 'controlled', 'freshdesk': 'controlled', 'hubspot': 'controlled',
  'jira': 'controlled', 'github': 'controlled', 'linkedin': 'controlled',
  'quickbooks': 'controlled', 'zoho-crm': 'controlled', 'zoho-people': 'controlled',
  'whatsapp-business': 'controlled', 'exotel': 'controlled',
  'razorpay': 'controlled', 'cleartax': 'controlled', 'keka': 'controlled',
  'darwinbox': 'controlled', 'workday': 'controlled', 'bamboohr': 'controlled',
};

export const GOV_LABEL: Record<GovTier, string> = {
  observe: 'Observe only',
  controlled: 'Controlled write',
  full: 'Full access',
};

export const GOV_COLOR: Record<GovTier, string> = {
  observe: 'border-blue-400/20 bg-blue-500/[0.07] text-blue-300',
  controlled: 'border-amber-400/20 bg-amber-500/[0.07] text-amber-300',
  full: 'border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300',
};

export function getGovTier(appId: string): GovTier {
  return GOVERNANCE_TIERS[appId] ?? 'controlled';
}
