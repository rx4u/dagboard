"use client";

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { buildDagGraph, mergeNewCommits } from '@/lib/sync';
import { autoDetectMetric } from '@/lib/metrics';
import { fetchGitHubCommits } from '@/lib/github';
import type { Commit, DagGraph, MetricConfig } from '@/lib/types';

function getActiveMetric(config: MetricConfig): MetricConfig | null {
  return config.enabled && config.pattern ? config : null;
}

export function useDagData() {
  const { metricConfig, setMetricConfig, graph, setGraph, settings, connection, connectDemo, refreshKey } = useStore();
  const qc = useQueryClient();

  const isDemo = connection?.serverUrl.startsWith('demo://') ?? false;
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;
  const githubRepo = isGitHub ? connection!.serverUrl.replace('github://', '') : null;
  const serverUrl = connection?.serverUrl ?? null;

  const graphRef = useRef<DagGraph | null>(graph);
  const metricRef = useRef<MetricConfig>(metricConfig);
  const graphBuilt = useRef(false);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { metricRef.current = metricConfig; }, [metricConfig]);

  // Reset graph-built flag when switching connections so new tab data is fetched
  useEffect(() => {
    graphBuilt.current = false;
    // Reconfigure the API client for the new server
    if (connection && !isDemo && !isGitHub) {
      api.configure(connection.serverUrl, connection.apiKey, connection.adminKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // Manual refresh — reset graph-built flag and remove cached queries
  useEffect(() => {
    if (refreshKey === 0) return;
    graphBuilt.current = false;
    if (!isDemo && !isGitHub && serverUrl) {
      qc.removeQueries({ queryKey: ['dag:commits', serverUrl] });
      qc.removeQueries({ queryKey: ['dag:leaves', serverUrl] });
    }
    if (isGitHub && githubRepo) {
      qc.removeQueries({ queryKey: ['github:commits', githubRepo] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Restore demo graph if lost on page reload (graph not persisted)
  useEffect(() => {
    if (isDemo && !graph) connectDemo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // Demo animation — append a synthetic commit every 5s to simulate live agent activity
  useEffect(() => {
    if (!isDemo) return;
    let tick = 0;
    const intervalId = setInterval(() => {
      const g = graphRef.current;
      if (!g || g.agents.length === 0) return;

      const agentId = g.agents[tick % g.agents.length];
      tick += 1;

      const leafHash = g.leaves.find(lh => g.nodes.get(lh)?.agentId === agentId);
      if (!leafHash) return;

      const parent = g.nodes.get(leafHash);
      if (!parent) return;

      const currentVal = parent.metric?.value ?? 0.9;
      const newVal = +(currentVal * (0.993 + Math.random() * 0.005)).toFixed(4);
      const newHash = Math.random().toString(16).slice(2, 10);

      const newCommit: Commit = {
        hash: newHash,
        parent_hash: leafHash,
        agent_id: agentId,
        message: `val_bpb: ${newVal} — training step ${parent.generation + 1}`,
        created_at: new Date().toISOString(),
      };

      const current = graphRef.current;
      if (!current) return;
      setGraph(mergeNewCommits(current, [newCommit], getActiveMetric(metricRef.current)));
    }, 5000);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, setGraph]);

  // Initial full fetch — staleTime:Infinity so it never auto-refetches for the same server
  // Skip in demo/github mode or if graph already set
  const { data: commits, isLoading, error } = useQuery<Commit[]>({
    queryKey: ['dag:commits', serverUrl],
    queryFn: () => {
      if (connection && !isDemo && !isGitHub) {
        api.configure(connection.serverUrl, connection.apiKey, connection.adminKey);
      }
      return api.listCommits({ limit: 10000 });
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !isDemo && !isGitHub && !graph,
  });

  // GitHub commits — fetched once, cached for 5 min per repo
  const { data: ghCommits, isLoading: ghLoading, error: ghError } = useQuery<Commit[]>({
    queryKey: ['github:commits', githubRepo],
    queryFn: () => {
      const [owner, repo] = githubRepo!.split('/');
      return fetchGitHubCommits(owner, repo);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    enabled: isGitHub && !graph,
    retry: 1,
  });

  // Build graph once commits arrive (AgentHub or GitHub)
  useEffect(() => {
    const incoming = commits ?? ghCommits;
    if (!incoming || incoming.length === 0 || graphBuilt.current) return;
    graphBuilt.current = true;

    let config = metricRef.current;
    if (!config.pattern) {
      const detected = autoDetectMetric(incoming.map(c => c.message));
      if (detected) {
        config = detected;
        setMetricConfig(detected);
        metricRef.current = detected;
      }
    }

    setGraph(buildDagGraph(incoming, getActiveMetric(config)));
  }, [commits, ghCommits, setGraph, setMetricConfig]);

  // Poll leaves for incremental updates — only after graph is built, never in demo/github
  const { data: currentLeaves } = useQuery<Commit[]>({
    queryKey: ['dag:leaves', serverUrl],
    queryFn: () => {
      if (connection && !isDemo && !isGitHub) {
        api.configure(connection.serverUrl, connection.apiKey, connection.adminKey);
      }
      return api.getLeaves();
    },
    refetchInterval: settings.dagPollInterval,
    enabled: !!graph && !isDemo && !isGitHub,
  });

  // Merge new commits when new leaf hashes appear
  useEffect(() => {
    if (!currentLeaves) return;
    const g = graphRef.current;
    if (!g) return;

    const knownLeaves = new Set(g.leaves);
    const newLeafHashes = currentLeaves.map(l => l.hash).filter(h => !knownLeaves.has(h));
    if (newLeafHashes.length === 0) return;

    Promise.all(newLeafHashes.map(h => api.getLineage(h))).then(lineages => {
      const current = graphRef.current;
      if (!current) return;
      const allNew = lineages.flat().filter(c => !current.nodes.has(c.hash));
      if (allNew.length === 0) return;
      setGraph(mergeNewCommits(current, allNew, getActiveMetric(metricRef.current)));
    });
  }, [currentLeaves, setGraph]);

  const loading = isLoading || ghLoading;
  const err = error ?? ghError;

  return { isLoading: loading && !graph, error: err };
}
