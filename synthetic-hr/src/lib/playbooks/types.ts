import type { ComponentType } from 'react';

export type PlaybookPackId = 'all' | 'hr' | 'support' | 'sales' | 'it';

export type PlaybookField =
  | { key: string; label: string; placeholder?: string; kind: 'text' }
  | { key: string; label: string; placeholder?: string; kind: 'textarea' };

export type PlaybookJob = { type: 'chat_turn' | 'workflow_run' | 'connector_action'; input: any };

export type Playbook = {
  id: string;
  pack: Exclude<PlaybookPackId, 'all'>;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  recommendedAgentType?: string;
  fields: PlaybookField[];
  buildJob: (input: Record<string, string>) => PlaybookJob;
};

export type PlaybookPack = {
  id: Exclude<PlaybookPackId, 'all'>;
  label: string;
  description: string;
};

