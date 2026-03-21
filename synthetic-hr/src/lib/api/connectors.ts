import { authenticatedFetch } from './_helpers';
import type { ApiResponse } from './_helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnifiedConnectorEntry = {
  /** Unique connector identifier, e.g. "salesforce", "zendesk" */
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  authType: 'oauth' | 'api_key' | 'none';
  /** Whether this connector has an OAuth install flow (marketplace) */
  hasOAuth: boolean;
  /** Whether this org has installed/connected this connector */
  installed: boolean;
  /** Connection status for installed connectors */
  connectionStatus: 'connected' | 'error' | 'expired' | 'syncing' | 'disconnected' | null;
  /** Number of org agents linked to this connector */
  agentCount: number;
  /** Last sync timestamp for installed connectors */
  lastSync: string | null;
  /** Underlying integration record id (if installed via integrations system) */
  integrationId: string | null;
  /** Underlying marketplace app id (if installed via marketplace) */
  appId: string | null;
  /** Bundles this connector belongs to */
  bundles: string[];
  /** Source system: "marketplace" or "integration" */
  source: 'marketplace' | 'integration';
};

export type ConnectorAction = {
  name: string;
  label: string;
  description: string;
  requiresApproval: boolean;
  enabled: boolean;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    enum?: string[];
  }>;
};

export type ConnectorActionResult = {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  pending?: boolean;
  approvalId?: string;
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const unifiedConnectorsApi = {
  /**
   * Fetch the full connector catalog enriched with org install status.
   * Pass `domain` to filter by category (e.g. "hr", "sales", "it").
   */
  async getCatalog(domain?: string): Promise<ApiResponse<UnifiedConnectorEntry[]>> {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return authenticatedFetch(`/connectors/catalog/unified${params}`, { method: 'GET' });
  },

  /**
   * Get the tool definitions available for a connector.
   * Returns an empty array for connectors without an action registry entry.
   */
  async getActions(connectorId: string): Promise<ApiResponse<ConnectorAction[]>> {
    return authenticatedFetch(`/connectors/${encodeURIComponent(connectorId)}/actions`, {
      method: 'GET',
    });
  },

  /**
   * Execute an action on a connected app on behalf of an agent or user.
   * Returns immediately with `pending: true` if the action requires approval.
   */
  async executeAction(
    connectorId: string,
    action: string,
    params: Record<string, any>,
    agentId?: string,
  ): Promise<ApiResponse<ConnectorActionResult>> {
    return authenticatedFetch(`/connectors/${encodeURIComponent(connectorId)}/execute`, {
      method: 'POST',
      body: JSON.stringify({ action, params, agentId }),
    });
  },

  /**
   * Link or unlink a set of connectors to/from an agent.
   * Pass the full desired list of connector ids — backend replaces the current set.
   */
  async updateAgentConnectors(
    agentId: string,
    connectorIds: string[],
  ): Promise<ApiResponse<{ connectorIds: string[] }>> {
    return authenticatedFetch(`/agents/${encodeURIComponent(agentId)}/connectors`, {
      method: 'PATCH',
      body: JSON.stringify({ connectorIds }),
    });
  },
};
