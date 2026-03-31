import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';

export type ActionNodeData = {
  label: string;
  tool?: string;
  integration?: string;
};

export const ActionNode = memo(({ data, selected }: NodeProps<ActionNodeData>) => (
  <div
    className={`bg-white dark:bg-gray-800 border-2 rounded-xl shadow-md px-4 py-3 min-w-[180px] max-w-[240px] ${
      selected ? 'border-purple-500' : 'border-purple-300 dark:border-purple-700'
    }`}
  >
    <Handle type="target" position={Position.Top} className="!bg-purple-400" />
    <div className="flex items-center gap-2 mb-1">
      <Zap className="w-4 h-4 text-purple-500 shrink-0" />
      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">Action</span>
    </div>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{data.label || 'Unnamed Action'}</p>
    {data.tool && (
      <p className="text-xs text-gray-400 mt-0.5 truncate">{data.tool}</p>
    )}
    {data.integration && (
      <span className="mt-1 inline-block text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded">
        via {data.integration}
      </span>
    )}
    <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
  </div>
));
ActionNode.displayName = 'ActionNode';
