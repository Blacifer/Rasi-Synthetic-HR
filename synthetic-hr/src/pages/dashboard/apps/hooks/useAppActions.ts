import { useCallback } from 'react';
import { api } from '../../../../lib/api-client';
import { toast } from '../../../../lib/toast';
import type { UnifiedApp } from '../types';

interface UseAppActionsOptions {
  reload: () => Promise<void>;
  markConnected: (connectorId: string) => void;
  onPostConnect?: (app: UnifiedApp) => void;
}

export function useAppActions({ reload, markConnected, onPostConnect }: UseAppActionsOptions) {
  const handleConnect = useCallback(async (app: UnifiedApp, creds: Record<string, string>) => {
    try {
      if (app.source === 'marketplace') {
        const res = await api.marketplace.install(app.appId, creds);
        if (res.success && res.data?.authUrl) {
          window.location.href = res.data.authUrl;
          return;
        }
        if (!res.success) { toast.error((res as any).error || 'Connection failed'); return; }
      } else {
        const res = await api.integrations.connect(app.appId, creds);
        if (!res.success) { toast.error((res as any).error || 'Connection failed'); return; }
      }
      toast.success(`${app.name} connected`);
      markConnected(app.id);
      onPostConnect?.(app);
    } catch (e: any) {
      toast.error(e?.message || 'Connection failed');
    }
  }, [markConnected, onPostConnect]);

  const handleDisconnect = useCallback(async (app: UnifiedApp) => {
    try {
      if (app.source === 'marketplace') {
        const res = await api.marketplace.uninstall(app.appData!.id);
        if (!res.success) throw new Error((res as any).error);
      } else {
        const res = await api.integrations.disconnect(app.integrationData.id);
        if (!res.success) throw new Error((res as any).error);
      }
      toast.success(`${app.name} disconnected`);
      void reload();
    } catch (e: any) {
      toast.error(e.message || 'Disconnect failed');
    }
  }, [reload]);

  const handleConfigure = useCallback(async (app: UnifiedApp, creds: Record<string, string>) => {
    try {
      if (app.source === 'marketplace') {
        const res = await api.marketplace.updateCredentials(app.appData!.id, creds);
        if (!res.success) throw new Error((res as any).error);
      } else {
        const res = await api.integrations.configure(app.appId, creds);
        if (!res.success) throw new Error((res as any).error);
      }
      toast.success(`${app.name} credentials updated`);
      void reload();
    } catch (e: any) {
      toast.error(e.message || 'Configuration failed');
    }
  }, [reload]);

  const handleTest = useCallback(async (app: UnifiedApp) => {
    try {
      const res = app.source === 'marketplace'
        ? await api.marketplace.testConnection(app.appData!.id)
        : await api.integrations.test(app.appId);
      if (res.success) {
        toast.success(`${app.name}: connection healthy`);
      } else {
        toast.error((res as any).error || 'Connection test failed');
      }
      return res.success;
    } catch (e: any) {
      toast.error(e.message || 'Connection test failed');
      return false;
    }
  }, []);

  const handleRefresh = useCallback(async (app: UnifiedApp) => {
    if (app.source !== 'integration') return;
    try {
      const res = await api.integrations.refresh(app.appId);
      if (res.success) {
        toast.success(`${app.name}: token refreshed`);
        void reload();
      } else {
        toast.error((res as any).error || 'Token refresh failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Token refresh failed');
    }
  }, [reload]);

  const handleInitOAuth = useCallback(async (app: UnifiedApp) => {
    try {
      const res = await api.integrations.initOAuth(app.appId, '/dashboard/apps', {}, false);
      if (res.success && (res.data as any)?.url) {
        window.location.href = (res.data as any).url;
      } else {
        toast.error((res as any).error || 'OAuth init failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'OAuth init failed');
    }
  }, []);

  return {
    handleConnect,
    handleDisconnect,
    handleConfigure,
    handleTest,
    handleRefresh,
    handleInitOAuth,
  };
}
