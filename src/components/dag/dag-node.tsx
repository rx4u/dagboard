"use client";

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { getAgentColor } from '@/lib/agent-colors';
import type { DagNodeData } from '@/lib/dag-layout';

const handleStyle = { opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 'none' };

function DagNodeRaw({ data }: NodeProps) {
  const { node, isBest, isSelected, isCompare } = data as DagNodeData;
  const color = getAgentColor(node.agentId);

  const borderWidth = isSelected || isCompare ? 2 : 0;
  const borderColor = isSelected ? color : isCompare ? '#A78BFA' : 'transparent';

  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className="dag-node-box"
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          backgroundColor: color + 'B3',
          border: `${borderWidth}px solid ${borderColor}`,
          boxSizing: 'border-box',
          outline: isBest ? `2px solid ${color}60` : 'none',
          outlineOffset: 3,
          transition: 'transform 100ms ease-out, box-shadow 100ms ease-out, border 80ms, outline 80ms',
          cursor: 'pointer',
        }}
      />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export const DagNodeComponent = memo(DagNodeRaw);
