import type { ExtractedMetric, MetricConfig } from './types';

const DEFAULT_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'val_bpb',    pattern: /val_bpb[:\s=]+([\d.]+)/i },
  { name: 'bpb',        pattern: /\bbpb[:\s=]+([\d.]+)/i },
  { name: 'loss',       pattern: /\bloss[:\s=]+([\d.]+)/i },
  { name: 'val_loss',   pattern: /val_loss[:\s=]+([\d.]+)/i },
  { name: 'accuracy',   pattern: /\baccuracy[:\s=]+([\d.]+)/i },
  { name: 'score',      pattern: /\bscore[:\s=]+([\d.]+)/i },
  { name: 'perplexity', pattern: /\bperplexity[:\s=]+([\d.]+)/i },
];

export function extractMetric(message: string, config: MetricConfig): ExtractedMetric | undefined {
  try {
    const regex = new RegExp(config.pattern, 'i');
    const match = message.match(regex);
    if (match?.[1]) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && isFinite(value)) {
        return { name: config.name, value };
      }
    }
  } catch { /* invalid regex */ }
  return undefined;
}

export function autoDetectMetric(messages: string[]): MetricConfig | null {
  if (messages.length === 0) return null;

  let best: { name: string; pattern: RegExp } | null = null;
  let bestCount = 0;

  for (const p of DEFAULT_PATTERNS) {
    let count = 0;
    for (const msg of messages) {
      if (p.pattern.test(msg)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = p;
    }
  }

  if (!best || bestCount < messages.length * 0.3) return null;

  const lowerIsBetter = ['loss', 'val_loss', 'bpb', 'val_bpb', 'perplexity'].includes(best.name);

  return {
    name: best.name,
    pattern: best.pattern.source,
    lowerIsBetter,
    enabled: true,
    autoDetected: true,
  };
}

export function findBest(
  metrics: { hash: string; value: number }[],
  lowerIsBetter: boolean,
): string | null {
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((a, b) =>
    lowerIsBetter ? a.value - b.value : b.value - a.value
  );
  return sorted[0].hash;
}
