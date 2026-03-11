"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { GitDiff, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { shortHash, timeAgo } from "@/lib/utils";
import { getAgentColor } from "@/lib/agent-colors";
import { Skeleton } from "@/components/ui/skeleton";

// Load diff viewer client-side only (it uses browser APIs)
const DiffViewer = dynamic(
  () => import("react-diff-viewer-continued").then((m) => m.default),
  { ssr: false }
);

function CommitPicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (hash: string) => void;
  options: { hash: string; agentId: string; message: string; createdAt: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.hash === value);

  return (
    <div className="relative flex-1 min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ghost mb-1.5">{label}</div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        className="w-full flex items-center gap-2 bg-surface-1 border border-border-default rounded-[6px] px-3 py-2 text-left hover:border-border-subtle transition-colors cursor-pointer"
      >
        {selected ? (
          <>
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getAgentColor(selected.agentId) }}
            />
            <span className="text-[12px] font-mono text-primary">{shortHash(selected.hash)}</span>
            <span className="text-[11px] text-ghost truncate flex-1">{selected.agentId} · {timeAgo(selected.createdAt)}</span>
          </>
        ) : (
          <span className="text-[12px] text-ghost">Select commit...</span>
        )}
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="text-ghost hover:text-muted flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-surface-1 border border-border-default rounded-[6px] z-50 max-h-[280px] overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.hash}
              onClick={() => { onChange(opt.hash); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors border-b border-border-subtle last:border-0 ${
                opt.hash === value ? "bg-surface-2" : ""
              }`}
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: getAgentColor(opt.agentId) }}
              />
              <span className="text-[12px] font-mono text-primary flex-shrink-0">{shortHash(opt.hash)}</span>
              <span className="text-[11px] text-ghost flex-shrink-0">{opt.agentId}</span>
              <span className="text-[11px] text-ghost truncate flex-1 text-right">{timeAgo(opt.createdAt)}</span>
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-ghost text-center">No commits available</div>
          )}
        </div>
      )}
    </div>
  );
}

const DEMO_DIFF = `--- a/train.py
+++ b/train.py
@@ -38,10 +38,10 @@ def build_model(config):
     return model

 def train_step(model, batch, optimizer, config):
-    lr = config.get("lr", 0.001)
+    lr = config.get("lr", 0.0003)
     outputs = model(batch["input_ids"])
     loss = criterion(outputs, batch["labels"])
-    loss = loss / config.get("grad_accum", 1)
+    loss = loss / config.get("grad_accum", 4)
     optimizer.zero_grad()
     loss.backward()
     torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
@@ -51,7 +51,7 @@ def train_step(model, batch, optimizer, config):
     return loss.item()

 def evaluate(model, val_loader):
-    model.train()
+    model.eval()
     total_loss = 0.0
     with torch.no_grad():
         for batch in val_loader:`;

export default function DiffPage() {
  const { graph, dag, connection } = useStore();
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;
  const isDemo = connection?.serverUrl.startsWith('demo://') ?? false;
  const repo = isGitHub ? (connection?.serverUrl.replace('github://', '') ?? '') : '';

  const [hashA, setHashA] = useState(dag.selectedNodeId ?? "");
  const [hashB, setHashB] = useState(dag.compareNodeId ?? "");

  const commitOptions = useMemo(() => {
    if (!graph) return [];
    return Array.from(graph.nodes.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((n) => ({
        hash: n.hash,
        agentId: n.agentId,
        message: n.message,
        createdAt: n.createdAt,
      }));
  }, [graph]);

  const canDiff = hashA && hashB && hashA !== hashB;

  const { data: serverDiffText, isLoading: serverLoading, error: serverError } = useQuery<string>({
    queryKey: ["diff", hashA, hashB],
    queryFn: () => api.getDiff(hashA, hashB),
    enabled: !!canDiff && !isGitHub && !isDemo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: githubDiffText, isLoading: githubLoading, error: githubError } = useQuery<string>({
    queryKey: ["github-diff", repo, hashA, hashB],
    queryFn: async () => {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/compare/${hashA}...${hashB}`,
        { headers: { Accept: 'application/vnd.github.v3.diff' } }
      );
      if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
      return res.text();
    },
    enabled: !!canDiff && isGitHub && !!repo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const diffText = isGitHub ? githubDiffText : (isDemo && canDiff) ? DEMO_DIFF : serverDiffText;
  const isLoading = isGitHub ? githubLoading : (!isDemo && serverLoading);
  const error = isGitHub ? githubError : serverError;

  // Parse unified diff into old/new strings for DiffViewer
  const { oldCode, newCode } = useMemo(() => {
    if (!diffText) return { oldCode: "", newCode: "" };

    const lines = diffText.split("\n");
    const oldLines: string[] = [];
    const newLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@") || line.startsWith("diff")) continue;
      if (line.startsWith("-")) {
        oldLines.push(line.slice(1));
      } else if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else {
        const content = line.startsWith(" ") ? line.slice(1) : line;
        oldLines.push(content);
        newLines.push(content);
      }
    }

    return {
      oldCode: oldLines.join("\n"),
      newCode: newLines.join("\n"),
    };
  }, [diffText]);

  const nodeA = hashA ? graph?.nodes.get(hashA) : undefined;
  const nodeB = hashB ? graph?.nodes.get(hashB) : undefined;

  return (
    <div>
      <div className="section-label mb-1.5">Diff</div>
      <div className="divider-fade mb-4" />

      {/* Commit Pickers */}
      <div className="flex items-end gap-3 mb-4">
        <CommitPicker
          label="Base (A)"
          value={hashA}
          onChange={setHashA}
          options={commitOptions}
        />
        <div className="text-ghost pb-2 flex-shrink-0">→</div>
        <CommitPicker
          label="Head (B)"
          value={hashB}
          onChange={setHashB}
          options={commitOptions}
        />
      </div>

      {/* Commit summaries */}
      {(nodeA || nodeB) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[nodeA, nodeB].map((node, i) => (
            <div key={i} className="border border-border-subtle rounded-[4px] p-3">
              {node ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getAgentColor(node.agentId) }}
                    />
                    <span className="text-[11px] text-ghost font-mono">{shortHash(node.hash)}</span>
                    <span className="text-[11px] text-ghost">{node.agentId}</span>
                    <span className="text-[11px] text-ghost ml-auto">{timeAgo(node.createdAt)}</span>
                  </div>
                  <p className="text-[12px] text-secondary line-clamp-2">{node.message}</p>
                  {node.metric && (
                    <div className="text-[11px] text-ghost mt-1 font-mono">
                      {node.metric.name}: {node.metric.value}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] text-ghost">{i === 0 ? "No base selected" : "No head selected"}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diff output */}
      {!canDiff && (
        <div className="flex flex-col items-center justify-center py-16">
          <GitDiff size={24} className="text-ghost mb-3" />
          <div className="text-[16px] font-medium text-muted mb-1">Select two commits to compare</div>
          <div className="text-[13px] text-ghost">
            {commitOptions.length === 0
              ? "Connect to a server and load commits first"
              : "Choose base and head commits above"}
          </div>
        </div>
      )}


{canDiff && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full rounded-[2px]" />
          ))}
        </div>
      )}

      {canDiff && error && (
        <div className="border border-border-subtle rounded-[6px] p-4 text-[12px] text-regressed">
          {error instanceof Error ? error.message : "Failed to load diff"}
        </div>
      )}

      {canDiff && diffText !== undefined && !isLoading && (
        <div className="border border-border-subtle rounded-[6px] overflow-hidden text-[12px]">
          {diffText.trim() === "" ? (
            <div className="p-6 text-center text-ghost text-[12px]">No differences between these commits</div>
          ) : (
            <DiffViewer
              oldValue={oldCode}
              newValue={newCode}
              splitView={false}
              useDarkTheme
              hideLineNumbers={false}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: "#0d0d0d",
                    diffViewerColor: "#a3a3a3",
                    addedBackground: "rgba(74, 222, 128, 0.08)",
                    addedColor: "#4ade80",
                    removedBackground: "rgba(248, 113, 113, 0.08)",
                    removedColor: "#f87171",
                    wordAddedBackground: "rgba(74, 222, 128, 0.2)",
                    wordRemovedBackground: "rgba(248, 113, 113, 0.2)",
                    gutterBackground: "#111111",
                    gutterBackgroundDark: "#111111",
                    highlightBackground: "rgba(255,255,255,0.04)",
                    highlightGutterBackground: "rgba(255,255,255,0.04)",
                    codeFoldBackground: "#111111",
                    emptyLineBackground: "transparent",
                    gutterColor: "#555555",
                    addedGutterBackground: "rgba(74, 222, 128, 0.1)",
                    removedGutterBackground: "rgba(248, 113, 113, 0.1)",
                    codeFoldContentColor: "#555555",
                  },
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
