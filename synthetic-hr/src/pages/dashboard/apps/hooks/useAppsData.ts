import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api-client';
import type { AIAgent } from '../../../../types';
import type { UnifiedApp } from '../types';
import { fromIntegration, getAppServiceId } from '../helpers';
import { FEATURED_IDS, CATEGORIES } from '../constants';

export function useAppsData(agents: AIAgent[] = []) {
  const [rawIntegrations, setRawIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const intsRes = await api.integrations.getAppsInventory();
      if (intsRes.success && Array.isArray(intsRes.data)) setRawIntegrations(intsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const allApps = useMemo<UnifiedApp[]>(() => rawIntegrations.map(fromIntegration), [rawIntegrations]);

  const connectedList = useMemo(() => allApps.filter((app) => app.connected), [allApps]);
  const browseList = useMemo(() => allApps, [allApps]);

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
    const serviceId = getAppServiceId(app);
    return agents.filter((a) => (a as any).integrationIds?.includes(serviceId)).map((a) => a.name);
  }, [agents]);

  // Stats
  const totalActions = connectedList.reduce((s, c) => s + (c.governanceSummary?.enabledActionCount || c.actionsUnlocked?.length || 0), 0);
  const errorCount = connectedList.filter((c) => c.status === 'error' || c.status === 'expired').length;
  const governedCount = connectedList.filter((c) => c.maturity === 'governed').length;

  // Optimistic update helpers
  const markConnected = useCallback((connectorId: string) => {
    setRawIntegrations((p) => p.map((i) => connectorId === `int:${i.id}` ? { ...i, lifecycleStatus: 'connected', status: 'connected' } : i));
  }, []);

  return {
    allApps, browseList, connectedList, myApps, featured,
    loading, reload: loadData, markConnected,
    categoryApps, agentNamesFor,
    totalActions, errorCount, governedCount,
  };
}
