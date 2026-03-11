import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';
import type { ConnectionConfig, DagViewState, AppSettings, MetricConfig, DagGraph } from './types';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function makeTabLabel(connection: ConnectionConfig): string {
  const url = connection.serverUrl;
  if (url.startsWith('demo://')) return 'demo';
  if (url.startsWith('github://')) {
    const parts = url.replace('github://', '').split('/');
    return parts[1] ?? parts[0] ?? 'repo';
  }
  try {
    return new URL(url).hostname.split('.')[0] ?? 'server';
  } catch {
    return url.slice(0, 12);
  }
}

export type WorkspaceTab = {
  id: string;
  label: string;
  connection: ConnectionConfig;
};

interface AppStore {
  connection: ConnectionConfig | null;
  isConnected: boolean;
  hasAdminKey: boolean;
  setConnection: (config: ConnectionConfig) => void;
  disconnect: () => void;

  tabs: WorkspaceTab[];
  activeTabId: string | null;
  addWorkspace: (label: string, connection: ConnectionConfig) => void;
  removeTab: (id: string) => void;
  switchTab: (id: string) => void;

  dag: DagViewState;
  selectNode: (id: string | null) => void;
  setCompareNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  filterByAgent: (agentId: string | null) => void;
  clearSelection: () => void;

  graph: DagGraph | null;
  setGraph: (g: DagGraph) => void;
  connectDemo: () => void;
  connectGitHub: (repo: string) => void;
  lastSyncedAt: number | null;
  refreshKey: number;
  requestRefresh: () => void;

  metricConfig: MetricConfig;
  updateMetricConfig: (partial: Partial<MetricConfig>) => void;
  setMetricConfig: (config: MetricConfig) => void;

  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
}

const DEFAULT_METRIC: MetricConfig = {
  pattern: '',
  name: '',
  lowerIsBetter: true,
  enabled: true,
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      connection: null,
      isConnected: false,
      get hasAdminKey() { return !!get().connection?.adminKey; },
      setConnection: (config) => {
        const { tabs, activeTabId } = get();
        const label = makeTabLabel(config);
        if (activeTabId) {
          // Update the current active tab's connection
          const newTabs = tabs.map(t => t.id === activeTabId ? { ...t, label, connection: config } : t);
          set({ connection: config, isConnected: true, graph: null, tabs: newTabs });
        } else {
          // First-ever connection — create a tab
          const newTab: WorkspaceTab = { id: makeId(), label, connection: config };
          set({ connection: config, isConnected: true, graph: null, tabs: [newTab], activeTabId: newTab.id });
        }
      },
      disconnect: () => set({ connection: null, isConnected: false, tabs: [], activeTabId: null, graph: null }),

      tabs: [],
      activeTabId: null,
      addWorkspace: (label, connection) => {
        const tabs = get().tabs;
        const newTab: WorkspaceTab = { id: makeId(), label: label || makeTabLabel(connection), connection };
        set({ connection, isConnected: true, graph: null, tabs: [...tabs, newTab], activeTabId: newTab.id });
      },
      removeTab: (id) => {
        const { tabs, activeTabId } = get();
        const newTabs = tabs.filter(t => t.id !== id);
        if (newTabs.length === 0) {
          set({ tabs: [], activeTabId: null, connection: null, isConnected: false, graph: null });
          return;
        }
        if (activeTabId === id) {
          const next = newTabs[0];
          set({ tabs: newTabs, activeTabId: next.id, connection: next.connection, isConnected: true, graph: null });
        } else {
          set({ tabs: newTabs });
        }
      },
      switchTab: (id) => {
        const { tabs, activeTabId } = get();
        if (id === activeTabId) return;
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;
        set({ activeTabId: id, connection: tab.connection, isConnected: true, graph: null });
      },

      dag: {
        selectedNodeId: null,
        compareNodeId: null,
        hoveredNodeId: null,
        filterByAgent: null,
      },
      selectNode: (id) =>
        set((s) => ({ dag: { ...s.dag, selectedNodeId: id, compareNodeId: null } })),
      setCompareNode: (id) =>
        set((s) => ({ dag: { ...s.dag, compareNodeId: id } })),
      hoverNode: (id) =>
        set((s) => ({ dag: { ...s.dag, hoveredNodeId: id } })),
      filterByAgent: (agentId) =>
        set((s) => ({ dag: { ...s.dag, filterByAgent: agentId } })),
      clearSelection: () =>
        set((s) => ({ dag: { ...s.dag, selectedNodeId: null, compareNodeId: null } })),

      graph: null,
      lastSyncedAt: null,
      refreshKey: 0,
      setGraph: (g) => set({ graph: g, lastSyncedAt: Date.now() }),
      requestRefresh: () => set(s => ({ graph: null, refreshKey: s.refreshKey + 1 })),
      connectDemo: () => {
        const { buildMockGraph, DEMO_CONNECTION } = require('./mock-data');
        const tabs = get().tabs;
        const newTab: WorkspaceTab = { id: makeId(), label: 'demo', connection: DEMO_CONNECTION };
        set({
          connection: DEMO_CONNECTION,
          isConnected: true,
          graph: buildMockGraph(),
          metricConfig: { pattern: 'val_bpb', name: 'val_bpb', lowerIsBetter: true, enabled: true },
          tabs: [...tabs, newTab],
          activeTabId: newTab.id,
        });
      },
      connectGitHub: (repo) => {
        const connection: ConnectionConfig = { serverUrl: `github://${repo}`, apiKey: '' };
        const tabs = get().tabs;
        const label = repo.split('/').pop() ?? 'repo';
        const newTab: WorkspaceTab = { id: makeId(), label, connection };
        set({
          connection,
          isConnected: true,
          graph: null,
          metricConfig: DEFAULT_METRIC,
          tabs: [...tabs, newTab],
          activeTabId: newTab.id,
        });
      },

      metricConfig: DEFAULT_METRIC,
      updateMetricConfig: (partial) =>
        set((s) => ({ metricConfig: { ...s.metricConfig, ...partial } })),
      setMetricConfig: (config) => set({ metricConfig: config }),

      settings: {
        dagPollInterval: 5000,
        messagePollInterval: 10000,
        density: 'dense',
        sidebarExpanded: false,
        theme: 'dark',
      },
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      toggleSidebar: () =>
        set((s) => ({ settings: { ...s.settings, sidebarExpanded: !s.settings.sidebarExpanded } })),
      toggleTheme: () =>
        set((s) => ({ settings: { ...s.settings, theme: s.settings.theme === 'dark' ? 'light' : 'dark' } })),
    }),
    {
      name: 'agenthub-store',
      partialize: (state) => ({
        connection: state.connection,
        isConnected: state.isConnected,
        metricConfig: state.metricConfig,
        settings: state.settings,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        // graph excluded — Map<string, DagNode> is not JSON-serializable
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migration: existing users have connection but no tabs array
        if (!state.tabs) state.tabs = [];
        if (state.isConnected && state.connection && state.tabs.length === 0) {
          const label = makeTabLabel(state.connection);
          const tab: WorkspaceTab = { id: makeId(), label, connection: state.connection };
          state.tabs = [tab];
          state.activeTabId = tab.id;
        }
      },
    }
  )
);

// Zustand persist rehydrates via microtasks, which always complete before
// React effects run (after browser paint). So by the time "mounted" is true,
// the store already has the values from localStorage.
export function useHasHydrated() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
