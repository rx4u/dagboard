"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  GitBranch, Trophy, ChatText, GitDiff, GearSix, Robot,
  CaretLineLeft, CaretLineRight, Sun, Moon, Plus, X, Plug, GithubLogo,
} from "@phosphor-icons/react";
import { useStore, useHasHydrated } from "@/lib/store";
import { api } from "@/lib/api";
import { parseGitHubRepo } from "@/lib/github";
import { cn, timeAgo } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: GitBranch, label: "DAG", shortcut: "1" },
  { href: "/dashboard/leaderboard", icon: Trophy, label: "Leaderboard", shortcut: "2" },
  { href: "/dashboard/messages", icon: ChatText, label: "Messages", shortcut: "3" },
  { href: "/dashboard/diff", icon: GitDiff, label: "Diff", shortcut: "4" },
  { href: "/dashboard/agents", icon: Robot, label: "Agents", shortcut: "5", requiresAdmin: true },
  { href: "/dashboard/settings", icon: GearSix, label: "Settings", shortcut: "6" },
];

function LogoMark() {
  return (
    <div
      className="w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 text-primary"
      style={{ background: "var(--surface-4)" }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="6" y="0" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="0" y="6" width="5" height="5" rx="0.8" fill="currentColor" />
      </svg>
    </div>
  );
}

// ─── Add Workspace Dialog ───────────────────────────────────────────────
function AddWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { addWorkspace, connectGitHub, connectDemo } = useStore();

  const [mode, setMode] = useState<"server" | "github">("server");
  const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const [apiKey, setApiKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleServer() {
    setError("");
    setLoading(true);
    try {
      api.configure(serverUrl, apiKey, adminKey || undefined);
      await api.health();
      addWorkspace("", { serverUrl, apiKey, adminKey: adminKey || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }

  function handleGitHub() {
    const parsed = parseGitHubRepo(githubRepo.trim());
    if (!parsed) { setError("Enter owner/repo or a GitHub URL"); return; }
    connectGitHub(`${parsed.owner}/${parsed.repo}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[360px] rounded-[8px] border border-border-default bg-surface-1 p-5 shadow-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] font-semibold text-primary">Add workspace</span>
          <button onClick={onClose} className="text-ghost hover:text-muted">
            <X size={14} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 border border-border-subtle rounded-[6px] p-0.5">
          {(["server", "github"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={cn(
                "flex-1 rounded-[4px] px-3 py-1.5 text-[12px] transition-colors",
                mode === m ? "bg-surface-3 text-primary" : "text-ghost hover:text-muted"
              )}
            >
              {m === "server" ? "AgentHub server" : "GitHub repo"}
            </button>
          ))}
        </div>

        {mode === "server" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted">Server URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[12px] font-mono bg-surface-2 border border-border-default text-primary focus:outline-none focus:border-border-subtle"
                placeholder="http://localhost:8080"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && !!apiKey && handleServer()}
                className="w-full rounded-[6px] px-3 py-2 text-[12px] font-mono bg-surface-2 border border-border-default text-primary focus:outline-none focus:border-border-subtle"
                placeholder="your-api-key"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted">
                Admin Key <span className="text-ghost">(optional)</span>
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[12px] font-mono bg-surface-2 border border-border-default text-primary focus:outline-none focus:border-border-subtle"
                placeholder="admin-key"
              />
            </div>
            {error && <p className="text-[11px] text-regressed">{error}</p>}
            <button
              onClick={handleServer}
              disabled={loading || !apiKey}
              className="w-full flex items-center justify-center gap-2 rounded-[6px] px-4 py-2 text-[12px] font-medium bg-surface-3 border border-border-default text-primary hover:bg-surface-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plug size={13} />
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted">Repository</label>
              <input
                type="text"
                value={githubRepo}
                onChange={e => setGithubRepo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && githubRepo && handleGitHub()}
                className="w-full rounded-[6px] px-3 py-2 text-[12px] font-mono bg-surface-2 border border-border-default text-primary focus:outline-none focus:border-border-subtle"
                placeholder="owner/repo or GitHub URL"
              />
            </div>
            {error && <p className="text-[11px] text-regressed">{error}</p>}
            <button
              onClick={handleGitHub}
              disabled={!githubRepo.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-[6px] px-4 py-2 text-[12px] font-medium bg-surface-3 border border-border-default text-primary hover:bg-surface-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GithubLogo size={13} />
              Visualize
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isConnected, connection, settings, tabs, activeTabId, switchTab, removeTab, addWorkspace, toggleSidebar, toggleTheme } = useStore();
  const hydrated = useHasHydrated();
  const expanded = settings.sidebarExpanded;
  const hasAdmin = !!connection?.adminKey;
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!isConnected) { router.push("/"); return; }
    // Migration: old localStorage has connection but no tabs (onRehydrateStorage mutation doesn't update Zustand)
    if (isConnected && connection && tabs.length === 0) {
      addWorkspace("", connection);
    }
  }, [hydrated, isConnected, connection, tabs.length, addWorkspace, router]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const visibleItems = NAV_ITEMS.filter(i => !i.requiresAdmin || hasAdmin);
      const num = parseInt(e.key);
      if (num >= 1 && num <= visibleItems.length) {
        router.push(visibleItems[num - 1].href);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router, toggleSidebar, hasAdmin]);

  if (!hydrated || !isConnected) return null;

  const visibleNav = NAV_ITEMS.filter(i => !i.requiresAdmin || hasAdmin);

  return (
    <div className="h-screen bg-base flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen flex-shrink-0 bg-surface-1 border-r border-border-subtle flex flex-col transition-all duration-200",
          expanded ? "w-[220px]" : "w-[56px]"
        )}
      >
        {/* Header: logo + name only */}
        <div
          className={cn(
            "h-[48px] flex items-center border-b border-border-subtle flex-shrink-0",
            expanded ? "px-3 gap-2" : "justify-center"
          )}
        >
          <Link href="/landing" className="flex items-center gap-2">
            <LogoMark />
            {expanded && (
              <span className="text-[13px] font-semibold text-primary truncate">dagboard</span>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
          {visibleNav.map((item, idx) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ animation: `fade-in 180ms var(--ease-out) ${idx * 30}ms both` }}
                className={cn(
                  "group flex items-center gap-3 rounded-[4px] transition-colors duration-150",
                  expanded ? "px-3 py-2" : "justify-center p-2",
                  isActive
                    ? "bg-surface-2 text-primary"
                    : "text-muted hover:text-secondary hover:bg-surface-2 hover:scale-[1.01]"
                )}
                title={!expanded ? `${item.label} (${idx + 1})` : undefined}
              >
                <item.icon size={16} weight={isActive ? "bold" : "regular"} className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110" />
                {expanded && (
                  <>
                    <span className="text-[13px] truncate">{item.label}</span>
                    <span className="ml-auto text-[11px] text-ghost opacity-0 group-hover:opacity-100 transition-opacity">{idx + 1}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: collapse toggle */}
        <div className="flex-shrink-0 border-t border-border-subtle px-2 py-2">
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center rounded-[4px] hover:bg-surface-2 transition-colors text-ghost hover:text-muted",
              expanded ? "px-3 py-2 gap-3" : "justify-center p-2"
            )}
            title={expanded ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}
          >
            {expanded ? <CaretLineLeft size={12} /> : <CaretLineRight size={12} />}
            {expanded && <span className="text-[12px]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header with workspace tabs */}
        <header className="h-[48px] bg-surface-1 border-b border-border-subtle flex items-center px-3 gap-2 flex-shrink-0 min-w-0">
          {/* Workspace tabs */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[12px] transition-colors flex-shrink-0 cursor-pointer select-none",
                  tab.id === activeTabId
                    ? "bg-surface-2 text-primary border border-border-default"
                    : "text-ghost hover:text-muted hover:bg-surface-2 border border-transparent"
                )}
                onClick={() => switchTab(tab.id)}
              >
                <span className="font-mono truncate max-w-[100px]">{tab.label}</span>
              </div>
            ))}

            {/* Add workspace button */}
            <button
              onClick={() => setShowAddWorkspace(true)}
              className="flex items-center justify-center w-6 h-6 text-ghost hover:text-muted rounded-[4px] hover:bg-surface-2 transition-colors flex-shrink-0"
              title="Add workspace"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {hasAdmin && (
              <span className="text-[11px] text-ghost">admin</span>
            )}
            <button
              onClick={toggleTheme}
              className="text-ghost hover:text-muted transition-colors"
              title={settings.theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {settings.theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-improved dot-pulse" />
              <span className="text-[11px] text-muted">Connected</span>
            </div>
          </div>
        </header>

        {/* Only this area re-renders on navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 animate-fade-up">{children}</div>
        </div>
      </div>

      {/* Add workspace dialog */}
      {showAddWorkspace && (
        <AddWorkspaceDialog onClose={() => setShowAddWorkspace(false)} />
      )}
    </div>
  );
}
