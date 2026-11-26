/**
 * dsh-weknora: a DeepSeek Harness plugin that gives the agent retrieval,
 * document reading and composed answers from a WeKnora knowledge base.
 * @module dsh-weknora
 */

import Schema from '@deepseek-ai/schemastery'
import { WeknoraClient } from './client.ts'
import { resolveConfig } from './config.ts'
import type { HarnessContext } from './harness.ts'
import { createTools } from './tools.ts'

export const name = 'dsh-weknora'

/** Cordis waits for the tool registry before applying this plugin. */
export const inject = ['tools'] as const

/**
 * The config schema shown to the loader, the config editor, and the Settings
 * page.
 *
 * Only the connection fields are declared, and every one of them is volatile:
 * DSH lets a settings form edit volatile fields live, and the browser half
 * receives them as synced references (the API key is a `secret`, so it never
 * rides to the browser). Everything else (`maxResults`, `toolPrefix`, `tools`,
 * …) stays a profile-file setting validated by `resolveConfig`.
 */
export const Config = Schema.object({
  baseUrl: Schema.string().volatile(),
  apiKey: Schema.string().role('secret').volatile(),
  tenantId: Schema.string().volatile(),
  knowledgeBaseIds: Schema.array(Schema.string()).volatile(),
  resourceUrls: Schema.string().volatile(),
  consoleUrl: Schema.string().volatile(),
})

export type { Config as WeknoraConfig } from './config.ts'
export { ConfigError, normalizeBaseUrl, resolveConfig } from './config.ts'
export { WeknoraApiError, WeknoraClient } from './client.ts'
export { createTools } from './tools.ts'

/** Config fields the runtime reads; volatile ones arrive as references. */
const CONFIG_FIELDS = [
  'baseUrl', 'apiKey', 'tenantId', 'knowledgeBaseIds', 'agentId', 'maxResults', 'maxChunkChars',
  'requestTimeoutMs', 'chatTimeoutMs', 'resourceUrls', 'toolPrefix', 'tools', 'consoleUrl',
] as const

/** Unwrap one config value: a volatile field on the Host is a reference. */
function plain(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    const candidate = value as { get?: unknown }
    if (typeof candidate.get === 'function') return (candidate.get as () => unknown)()
  }
  return value
}

/** Read the plugin's config row into plain values, resolving volatile fields. */
export function readConfig(raw: unknown): Record<string, unknown> {
  const source = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const out: Record<string, unknown> = {}
  for (const field of CONFIG_FIELDS) {
    const value = plain(source[field])
    if (value !== undefined) out[field] = value
  }
  return out
}

/**
 * Register the configured tools, and keep them current while the settings page
 * edits volatile fields.
 *
 * A volatile update re-reads the config and swaps the tool registrations: the
 * first build must fail the load on an invalid row, while a later live edit
 * that validates badly keeps the previous tools and logs a warning instead of
 * taking the plugin down.
 *
 * @param ctx - the Cordis context, with `ctx.tools` injected.
 * @param config - the plugin's `config` row; validated here so a typo fails the load.
 */
export function apply(ctx: HarnessContext, config: unknown): void {
  let disposers: Array<() => void> = []
  const disposeTools = (): void => {
    for (const dispose of disposers) dispose()
    disposers = []
  }
  const rebuild = (strict: boolean): void => {
    let resolved
    try {
      resolved = resolveConfig(readConfig(config) as never)
    } catch (error) {
      if (strict) throw error
      ctx.logger?.warn('dsh-weknora: keeping the previous tools; the updated config is invalid', error)
      return
    }
    disposeTools()
    const client = new WeknoraClient(resolved)
    for (const definition of createTools(client, resolved)) {
      disposers.push(ctx.tools.register(definition))
    }
    ctx.logger?.info(`dsh-weknora: registered ${disposers.length} tool(s) against ${resolved.baseUrl}`)
  }
  rebuild(true)
  ctx.on?.('loader/volatile-update', () => { rebuild(false) })
  ctx.effect?.(() => () => { disposeTools() }, 'weknora: tool registrations')
}
