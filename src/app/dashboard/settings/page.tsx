"use client";

import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const {
    connection, settings, metricConfig,
    updateSettings, updateMetricConfig, disconnect,
  } = useStore();

  return (
    <div>
      <div className="section-label mb-1.5">Settings</div>
      <div className="divider-fade mb-6" />

      <div className="max-w-[480px] space-y-5">

        {/* Metric Extraction (MOST IMPORTANT SETTINGS PANEL) */}
        <div className="border border-border-default rounded-[6px] p-4">
          <div className="section-label mb-3">Metric Extraction</div>
          <p className="text-[11px] text-muted mb-4">
            Metrics are extracted from commit messages using regex.
            Leave pattern empty for auto-detection.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Pattern
                <span className="text-ghost ml-1 normal-case tracking-normal">(regex, group 1 = value)</span>
              </Label>
              <Input
                value={metricConfig.pattern}
                onChange={(e) => updateMetricConfig({ pattern: e.target.value })}
                className="bg-surface-1 border-border-default text-primary placeholder:text-ghost rounded-[6px] h-9 text-[13px]"
                placeholder="val_bpb:\s*([\d.]+)  (empty = auto-detect)"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Metric Name
              </Label>
              <Input
                value={metricConfig.name}
                onChange={(e) => updateMetricConfig({ name: e.target.value })}
                className="bg-surface-1 border-border-default text-primary placeholder:text-ghost rounded-[6px] h-9 text-[13px]"
                placeholder="val_bpb  (auto-detected if empty)"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Sort Direction
              </Label>
              <div className="flex gap-2">
                {([
                  { value: true, label: "lower is better" },
                  { value: false, label: "higher is better" },
                ] as const).map((opt) => (
                  <Button
                    key={String(opt.value)}
                    variant={metricConfig.lowerIsBetter === opt.value ? "default" : "outline"}
                    onClick={() => updateMetricConfig({ lowerIsBetter: opt.value })}
                    className={`h-7 px-3 text-[11px] rounded-[4px] ${
                      metricConfig.lowerIsBetter === opt.value
                        ? "bg-surface-3 border-border-default text-primary"
                        : "border-border-subtle text-muted hover:text-secondary hover:bg-surface-2"
                    }`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                loss, perplexity, val_bpb = lower is better.
                accuracy, score = higher is better.
              </p>
            </div>

            {/* Preview section: populated once DAG data is available */}
            <div className="border border-border-subtle rounded-[4px] p-3 mt-2">
              <div className="text-[11px] font-medium text-muted mb-2">Preview</div>
              <p className="text-[11px] text-ghost">
                Connect to a server and load commits to preview metric extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Connection */}
        <div className="border border-border-default rounded-[6px] p-4">
          <div className="section-label mb-3">Connection</div>
          <div className="text-[13px] text-secondary mb-1">{connection?.serverUrl}</div>
          <div className="flex gap-4 text-[11px] text-ghost mb-4">
            <span>api key: ••••••••</span>
            {connection?.adminKey && <span>admin key: ••••••••</span>}
          </div>
          <Button
            variant="ghost"
            onClick={disconnect}
            className="text-[11px] text-regressed hover:text-regressed hover:bg-surface-2 h-7 px-2 rounded-[4px]"
          >
            Disconnect
          </Button>
        </div>

        {/* Polling */}
        <div className="border border-border-default rounded-[6px] p-4">
          <div className="section-label mb-3">Polling Intervals</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-secondary">DAG refresh (leaves)</span>
              <span className="text-[13px] text-muted">{settings.dagPollInterval / 1000}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-secondary">Messages refresh</span>
              <span className="text-[13px] text-muted">{settings.messagePollInterval / 1000}s</span>
            </div>
          </div>
        </div>

        {/* Density */}
        <div className="border border-border-default rounded-[6px] p-4">
          <div className="section-label mb-3">Density</div>
          <div className="flex gap-2">
            {(["dense", "comfortable"] as const).map((d) => (
              <Button
                key={d}
                variant={settings.density === d ? "default" : "outline"}
                onClick={() => updateSettings({ density: d })}
                className={`h-7 px-3 text-[11px] rounded-[4px] ${
                  settings.density === d
                    ? "bg-surface-3 border-border-default text-primary"
                    : "border-border-subtle text-muted hover:text-secondary hover:bg-surface-2"
                }`}
              >
                {d}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
