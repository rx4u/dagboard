"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plug, CaretDown, CaretUp, GithubLogo, ArrowLeft } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useStore, useHasHydrated } from "@/lib/store";
import { parseGitHubRepo } from "@/lib/github";

const GITHUB_URL = "https://github.com/rx4u/dagboard";
const KARPATHY_URL = "https://github.com/karpathy/agenthub";

function LogoMark() {
  return (
    <div
      className="w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0"
      style={{ background: "var(--surface-4)", color: "var(--text-primary)" }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <rect x="0" y="0" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="6" y="0" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="0" y="6" width="5" height="5" rx="0.8" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function ConnectPage() {
  const router = useRouter();
  const { setConnection, isConnected, connectDemo, connectGitHub } = useStore();
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (hydrated && isConnected) router.push("/dashboard");
  }, [hydrated, isConnected, router]);

  const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const [apiKey, setApiKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubRepo, setGithubRepo] = useState("karpathy/nanoGPT");

  function handleGitHub() {
    const parsed = parseGitHubRepo(githubRepo.trim());
    if (!parsed) { setError("Enter a valid repo: owner/repo or a GitHub URL"); return; }
    setError("");
    connectGitHub(`${parsed.owner}/${parsed.repo}`);
    router.push("/dashboard");
  }

  async function handleConnect() {
    setError("");
    setLoading(true);
    try {
      api.configure(serverUrl, apiKey, adminKey || undefined);
      await api.health();
      setConnection({ serverUrl, apiKey, adminKey: adminKey || undefined });
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Cannot reach server. Check the URL and make sure agenthub is running.')
      } else if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('Forbidden')) {
        setError('Invalid API key.')
      } else if (msg.includes('timeout') || msg.includes('AbortError')) {
        setError('Connection timed out.')
      } else {
        setError(`Connection failed: ${msg}`)
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--surface-1)",
    border: "1px solid var(--border-default)",
    color: "var(--text-primary)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-10" style={{ background: "var(--base)" }}>
      <div className="w-full max-w-[800px] flex flex-col md:flex-row gap-0 md:gap-16 items-start md:items-center">

        {/* ─── Left: info panel ─── */}
        <div className="flex-1 min-w-0 mb-8 md:mb-0">
          {/* Back arrow */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 mb-5 text-[11px] transition-colors"
            style={{ color: "var(--text-ghost)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-ghost)"; }}
          >
            <ArrowLeft size={12} />
            Back
          </Link>

          <Link href="/" className="flex items-center gap-2.5 mb-6 md:mb-8 w-fit">
            <LogoMark />
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>dagboard</span>
          </Link>

          <h1 className="text-[22px] md:text-[26px] font-semibold leading-snug mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Mission control for<br />AI agent experiments.
          </h1>
          <p className="text-[13px] leading-relaxed mb-6 md:mb-8" style={{ color: "var(--text-muted)" }}>
            An open-source dashboard for{" "}
            <a href={KARPATHY_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
              karpathy/agenthub
            </a>
            . Visualizes the experiment DAG, ranks results, diffs commits, and shows agent messages.
          </p>

          <div className="space-y-5 hidden md:block">
            {[
              { n: "01", title: "Connect an AgentHub server", desc: <>Paste your server URL and API key. Get these from your <a href={KARPATHY_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}>karpathy/agenthub</a> instance.</> },
              { n: "02", title: "Visualize a GitHub repo", desc: <>No server needed. Paste any public GitHub repo URL or <span style={{ color: "var(--text-muted)" }}>owner/repo</span> to visualize its commit DAG.</> },
              { n: "03", title: "Try the demo", desc: "Explore the dashboard with synthetic data. No setup required." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-3">
                <div className="text-[10px] font-medium tabular-nums pt-0.5 w-5 flex-shrink-0" style={{ color: "var(--text-ghost)" }}>{n}</div>
                <div>
                  <div className="text-[12px] font-medium mb-0.5" style={{ color: "var(--text-secondary)" }}>{title}</div>
                  <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-ghost)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] transition-colors"
              style={{ color: "var(--text-ghost)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
              <GithubLogo size={12} />dagboard source
            </a>
            <span style={{ color: "var(--border-default)" }}>·</span>
            <a href="/" className="text-[11px] transition-colors"
              style={{ color: "var(--text-ghost)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
              About
            </a>
          </div>
        </div>

        {/* ─── Vertical divider ─── */}
        <div className="hidden md:block w-px self-stretch flex-shrink-0" style={{ background: "var(--border-subtle)" }} />

        {/* ─── Right: tabbed form ─── */}
        <div className="w-full md:w-[320px] flex-shrink-0">
          {/* ── GitHub section (top — zero friction) ── */}
          <div className="mb-5">
            <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-ghost)" }}>
              No server needed
            </p>
            <div className="flex gap-2">
              <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && githubRepo && handleGitHub()}
                className="flex-1 min-w-0 rounded-[6px] px-3 py-2 text-[12px] focus:outline-none transition-colors font-mono"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                placeholder="owner/repo or GitHub URL" />
              <button onClick={handleGitHub} disabled={!githubRepo.trim()}
                className="flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                onMouseEnter={(e) => { if (githubRepo.trim()) (e.currentTarget as HTMLElement).style.background = "var(--surface-4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-3)"; }}>
                <GithubLogo size={13} />
                Visualize
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-ghost)" }}>
              Paste any public GitHub repo — owner/repo or full URL
            </p>
          </div>

          {/* ── or divider ── */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
            <span className="text-[11px]" style={{ color: "var(--text-ghost)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
          </div>

          {/* ── AgentHub server section ── */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-ghost)" }}>
              Have an agenthub server?
            </p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] block" style={{ color: "var(--text-muted)" }}>Server URL</label>
                <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full rounded-[6px] px-3 py-2 text-[12px] focus:outline-none transition-colors font-mono"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                  placeholder="http://localhost:8080" />
                <p className="text-[11px]" style={{ color: 'var(--text-ghost)', lineHeight: 1.5 }}>
                  Run agenthub locally:{' '}
                  <code style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    pip install agenthub &amp;&amp; ah serve
                  </code>
                  , then enter{' '}
                  <code style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    http://localhost:8000
                  </code>
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] block" style={{ color: "var(--text-muted)" }}>API Key</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && !!apiKey && handleConnect()}
                  className="w-full rounded-[6px] px-3 py-2 text-[12px] focus:outline-none transition-colors font-mono"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                  placeholder="your-api-key" />
              </div>
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[11px] transition-colors"
                style={{ color: "var(--text-ghost)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
                {showAdvanced ? <CaretUp size={11} /> : <CaretDown size={11} />}
                Advanced
              </button>
              {showAdvanced && (
                <div className="space-y-1.5">
                  <label className="text-[11px] block" style={{ color: "var(--text-muted)" }}>
                    Admin Key <span style={{ color: "var(--text-ghost)" }}>(optional)</span>
                  </label>
                  <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full rounded-[6px] px-3 py-2 text-[12px] focus:outline-none transition-colors font-mono"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                    placeholder="admin-key" />
                  <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>Enables agent creation from the dashboard</p>
                </div>
              )}
              {error && <p className="text-[11px]" style={{ color: "var(--regressed)" }}>{error}</p>}
              <button onClick={handleConnect} disabled={loading || !apiKey}
                className="w-full flex items-center justify-center gap-2 rounded-[6px] px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                onMouseEnter={(e) => { if (!loading && apiKey) (e.currentTarget as HTMLElement).style.background = "var(--surface-4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-3)"; }}>
                <Plug size={14} />
                {loading ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>
              No server?{" "}
              <button onClick={() => { connectDemo(); router.push("/dashboard"); }}
                className="transition-colors underline underline-offset-2"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                Try demo
              </button>
            </p>
            <a href={KARPATHY_URL} className="text-[11px] transition-colors" style={{ color: "var(--text-ghost)" }}
              target="_blank" rel="noopener"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
              karpathy/agenthub
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
