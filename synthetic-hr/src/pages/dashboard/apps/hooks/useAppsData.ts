import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, type MarketplaceApp, type AppBundle } from '../../../../lib/api-client';
import type { AIAgent } from '../../../../types';
import type { UnifiedApp } from '../types';
import { fromMarketplaceApp, fromIntegration } from '../helpers';
import { FEATURED_IDS, CATEGORIES } from '../constants';

// Sub-integrations covered by a parent marketplace app
const COVERED_BY_MARKETPLACE: Record<string, string[]> = {
  'zoho': ['zoho_people'],
  'google-workspace': ['google_workspace'],
  'microsoft-365': ['microsoft_365'],
};

export function useAppsData(agents: AIAgent[] = []) {
  const [rawApps, setRawApps] = useState<MarketplaceApp[]>([]);
  const [rawIntegrations, setRawIntegrations] = useState<any[]>([]);
  const [bundles, setBundles] = useState<AppBundle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, intsRes, bundlesRes] = await Promise.all([
        api.marketplace.getAll(),
        api.integrations.getAll(),
        api.marketplace.getBundles(),
      ]);
      if (appsRes.success && Array.isArray(appsRes.data)) setRawApps(appsRes.data);
      if (intsRes.success && Array.isArray(intsRes.data)) setRawIntegrations(intsRes.data);
      if (bundlesRes.success && Array.isArray(bundlesRes.data)) setBundles(bundlesRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Merge marketplace + integrations into a unified list
  const allApps = useMemo<UnifiedApp[]>(() => [
    ...rawApps.map(fromMarketplaceApp),
    ...rawIntegrations.map(fromIntegration),
  ], [rawApps, rawIntegrations]);

  // Connected list with deduplication (marketplace wins)
  const connectedList = useMemo(() => {
    const connected = allApps.filter((c) => c.connected);
    const marketplaceIds = new Set(
      connected.filter((c) => c.source === 'marketplace').map((c) => c.appData?.id).filter(Boolean)
    );
    return connected.filter((c) => c.source !== 'integration' || !marketplaceIds.has(c.integrationData?.id));
  }, [allApps]);

  // Deduplicated browse list (includes sub-product handling)
  const browseList = useMemo(() => {
    const marketplaceIds = new Set(
      allApps.filter((c) => c.source === 'marketplace').map((c) => c.appData?.id).filter(Boolean)
    );
    const coveredIntegrationIds = new Set(
      Object.entries(COVERED_BY_MARKETPLACE)
        .filter(([appId]) => marketplaceIds.has(appId))
        .flatMap(([, ids]) => ids)
    );
    return allApps.filter((c) =>
      c.source !== 'integration' || (!marketplaceIds.has(c.integrationData?.id) && !coveredIntegrationIds.has(c.integrationData?.id))
    );
  }, [allApps]);

  const myApps = useMemo(() => connectedList, [connectedList]);

  const featured = useMemo(() =>
    FEATURED_IDS.map((id) => browseList.find((a) => a.appId === id)).filter(Boolean) as UnifiedApp[],
  [browseList]);

  const categoryApps = useCallback((catId: string) =>
    browseList.filter((a) => {
      const cat = CATEGORIES.find((c) => c.id === catId);
      return cat ? a.category.toLowerCase() === cat.apiCategory : false;
    }),
  [browseList]);

  const agentNamesFor = useCallback((app: UnifiedApp): string[] => {
    if (app.source === 'marketplace' && app.appData) {
      const ids = new Set(app.appData.relatedAgentIds);
      return agents.filter((a) => ids.has(a.id)).map((a) => a.name);
    }
    if (app.source === 'integration') {
      const sid = app.integrationData?.id;
      return agents.filter((a) => (a as any).integrationIds?.includes(sid)).map((a) => a.name);
    }
    return [];
  }, [agents]);

  // Stats
  const totalActions = connectedList.reduce((s, c) => s + (c.governanceSummary?.enabledActionCount || c.actionsUnlocked?.length || 0), 0);
  const errorCount = connectedList.filter((c) => c.status === 'error' || c.status === 'expired').length;
  const governedCount = connectedList.filter((c) => c.maturity === 'governed').length;

  // Optimistic update helpers
  const markConnected = useCallback((connectorId: string) => {
    setRawApps((p) => p.map((a) => connectorId === `app:${a.id}` ? { ...a, installed: true } : a));
    setRawIntegrations((p) => p.map((i) => connectorId === `int:${i.id}` ? { ...i, lifecycleStatus: 'connected', status: 'connected' } : i));
  }, []);

  return {
    allApps, browseList, connectedList, myApps, featured, bundles,
    loading, reload: loadData, markConnected,
    categoryApps, agentNamesFor,
    totalActions, errorCount, governedCount,
    rawApps,
  };
}
