import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { parseConfig } from './config.js'
import { AgenthubClient } from './api.js'
import { buildStateFromHistory } from './state.js'
import { buildPageSummary } from './page.js'
import { runSidecar } from './sidecar.js'

function loadConfig(configPath: string) {
  const raw = readFileSync(resolve(configPath), 'utf-8')
  return parseConfig(raw)
}

export function buildCli(): Command {
  const program = new Command()
    .name('conductor')
    .description('Orchestrate agenthub agent swarms')
    .version('0.1.0')

  program
    .command('start')
    .description('Start the conductor sidecar process')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts: { config: string }) => {
      await runSidecar(opts.config)
    })

  program
    .command('page')
    .description('Print context summary for the current session')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts: { config: string }) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      const anthropic = new Anthropic()
      const channels = [config.checkpoints.channel, ...config.agents.map(a => a.id)]
      const allPosts = await Promise.all(channels.map(ch => api.listPosts(ch, 200).catch(() => [])))
      const state = buildStateFromHistory(
        config.tasks,
        allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at))
      )
      const summary = await buildPageSummary(config, api, anthropic, state)
      process.stdout.write(summary + '\n')
    })

  program
    .command('approve <task-id>')
    .description('Approve a checkpoint')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (taskId: string, opts: { config: string }) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      await api.createPost(config.checkpoints.channel, `APPROVE: ${taskId}`)
      process.stdout.write(`Approved: ${taskId}\n`)
    })

  program
    .command('reject <task-id>')
    .description('Reject a checkpoint')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (taskId: string, opts: { config: string }) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      await api.createPost(config.checkpoints.channel, `REJECT: ${taskId}`)
      process.stdout.write(`Rejected: ${taskId}\n`)
    })

  program
    .command('status')
    .description('Show current task status')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts: { config: string }) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      const channels = [config.checkpoints.channel, ...config.agents.map(a => a.id)]
      const allPosts = await Promise.all(channels.map(ch => api.listPosts(ch, 200).catch(() => [])))
      const state = buildStateFromHistory(
        config.tasks,
        allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at))
      )
      for (const [id, ts] of state.tasks) {
        process.stdout.write(`${id}: ${ts.status}\n`)
      }
    })

  return program
}
