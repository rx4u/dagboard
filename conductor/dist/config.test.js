import { describe, it, expect } from 'vitest';
import { parseConfig, ConfigError } from './config.js';
const VALID_YAML = `
dagboard:
  url: http://localhost:8080
  api_key: test-key
agents:
  - id: agent-alpha
    model: claude-opus-4
tasks:
  - id: task-1
    description: Implement auth
    channel: agent-alpha
    checkpoint: before_start
  - id: task-2
    description: Write tests
    channel: agent-alpha
    depends_on: task-1
    checkpoint: none
observer:
  enabled: true
  model: claude-haiku-3
  interval_minutes: 15
  channel: conductor-observer
checkpoints:
  channel: conductor-checkpoints
  timeout_hours: 8
context:
  channel: conductor-log
stall:
  threshold_minutes: 30
`;
describe('parseConfig', () => {
    it('parses valid YAML', () => {
        const cfg = parseConfig(VALID_YAML);
        expect(cfg.dagboard.url).toBe('http://localhost:8080');
        expect(cfg.tasks).toHaveLength(2);
        expect(cfg.tasks[0].checkpoint).toBe('before_start');
    });
    it('throws on missing dagboard.url', () => {
        const bad = VALID_YAML.replace('url: http://localhost:8080', '');
        expect(() => parseConfig(bad)).toThrow(ConfigError);
    });
    it('throws on invalid checkpoint value', () => {
        const bad = VALID_YAML.replace('checkpoint: before_start', 'checkpoint: invalid');
        expect(() => parseConfig(bad)).toThrow(ConfigError);
    });
    it('throws on circular depends_on', () => {
        const circularYaml = `
dagboard:
  url: http://localhost:8080
  api_key: test-key
agents:
  - id: agent-alpha
    model: claude-opus-4
tasks:
  - id: task-1
    description: Implement auth
    channel: agent-alpha
    checkpoint: none
    depends_on: task-2
  - id: task-2
    description: Write tests
    channel: agent-alpha
    checkpoint: none
    depends_on: task-1
observer:
  enabled: false
  model: claude-haiku-3
  interval_minutes: 15
  channel: conductor-observer
checkpoints:
  channel: conductor-checkpoints
  timeout_hours: 8
context:
  channel: conductor-log
stall:
  threshold_minutes: 30
`;
        expect(() => parseConfig(circularYaml)).toThrow(/circular/i);
    });
    it('throws on depends_on referencing unknown task', () => {
        const bad = VALID_YAML.replace('depends_on: task-1', 'depends_on: task-999');
        expect(() => parseConfig(bad)).toThrow(/unknown/i);
    });
});
