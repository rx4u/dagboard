"use client";

import { useState } from "react";
import { Robot, Plus, Copy, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { getAgentColor } from "@/lib/agent-colors";
import { api } from "@/lib/api";

export default function AgentsPage() {
  const { connection, graph } = useStore();
  const hasAdminKey = !!connection?.adminKey;
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;

  const agents = graph?.agents ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate() {
    if (!newAgentId.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const agent = await api.createAgent(newAgentId.trim());
      setCreatedKey(agent.api_key ?? "");
      setNewAgentId("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="section-label">Agents</div>
        {hasAdminKey && (
          <Button
            onClick={() => { setShowCreate(true); setCreatedKey(""); setCreateError(""); }}
            className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[4px] h-7 px-2 text-[11px] font-medium gap-1"
          >
            <Plus size={14} />
            Create Agent
          </Button>
        )}
      </div>
      <div className="divider-fade mb-6" />

      {/* Create agent form */}
      {showCreate && hasAdminKey && (
        <div className="border border-border-default rounded-[6px] p-4 mb-6 max-w-[400px]">
          <div className="section-label mb-3">Create Agent</div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Agent ID
              </Label>
              <Input
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-surface-1 border-border-default text-primary placeholder:text-ghost rounded-[6px] h-9 text-[13px]"
                placeholder="agent-4"
                disabled={creating}
              />
            </div>

            {createdKey && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  API Key
                  <span className="text-ghost ml-1 normal-case tracking-normal">(copy now — shown once)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdKey}
                    className="bg-surface-1 border-border-default text-primary rounded-[6px] h-9 text-[11px] flex-1 font-mono"
                  />
                  <Button
                    onClick={handleCopy}
                    className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[4px] h-9 w-9 p-0"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <p className="text-[11px] text-ghost">
                  Agent created. Run <span className="font-mono bg-surface-2 px-1 rounded-[2px]">ah join --key &lt;api_key&gt;</span> to connect.
                </p>
              </div>
            )}

            {createError && (
              <p className="text-[11px] text-regressed">{createError}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newAgentId.trim() || creating}
                className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[6px] h-8 px-3 text-[12px] font-medium"
              >
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowCreate(false); setCreatedKey(""); setNewAgentId(""); setCreateError(""); }}
                className="text-muted hover:text-secondary hover:bg-surface-2 rounded-[6px] h-8 px-3 text-[12px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasAdminKey && !isGitHub && (
        <p className="text-[11px] text-muted mb-6">
          Admin key required to create agents. Reconnect with an admin key via Settings.
        </p>
      )}

      {/* Agent list from graph */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Robot size={24} className="text-ghost mb-3" />
          <div className="text-[16px] font-medium text-muted mb-1">No agents detected</div>
          <div className="text-[13px] text-muted">
            {isGitHub ? "No contributors found in this repository" : "Agents appear here once commits are pushed to the server"}
          </div>
        </div>
      ) : (
        <div className="border border-border-subtle rounded-[6px] overflow-hidden max-w-[560px]">
          <div className="grid grid-cols-[1fr_80px] gap-0 px-4 py-2 border-b border-border-subtle bg-surface-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Agent</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Commits</div>
          </div>
          {agents.map((agentId) => {
            const color = getAgentColor(agentId);
            const commitCount = graph
              ? Array.from(graph.nodes.values()).filter((n) => n.agentId === agentId).length
              : 0;

            return (
              <div
                key={agentId}
                className="grid grid-cols-[1fr_80px] gap-0 px-4 py-3 border-b border-border-subtle last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[13px] text-secondary">{agentId}</span>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-[12px] text-ghost font-mono">{commitCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
