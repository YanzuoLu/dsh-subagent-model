import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

export const name = 'subagent-model'
export const inject = ['agents', 'llm', 'storageDomain', 'connection']

/**
 * Browser-facing routes: POST <ROUTE_PREFIX>/get and <ROUTE_PREFIX>/set with a
 * JSON body. They sit on the shared /api channel, so the Connection's host
 * fence and browser-session cookie check run before them.
 */
export const ROUTE_PREFIX = '/api/subagent-model'

const routeSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1).optional(),
})

/**
 * One top-level session's override for every in-process subagent below it.
 * `inherit` follows the session's current model, optionally with its own
 * reasoning effort; `custom` pins one route. A session without a record is
 * not overridden.
 */
const overrideSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit'), reasoningEffort: z.string().min(1).optional() }),
  routeSchema.extend({ mode: z.literal('custom') }),
])

const domainSpec = defineDomain({
  name: 'subagent_model',
  version: 1,
  tables: { overrides: domainTable(overrideSchema) },
})

const requestSchema = z.object({ sessionId: z.string().min(1) })
const setRequestSchema = requestSchema.extend({ override: overrideSchema.nullable() })

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(domainSpec)
  ctx.effect(() => () => domain.close(), 'subagent-model: storage domain')
  const overrides = domain.table('overrides')

  /** Top-level session that owns a subagent tree, or undefined when a live link is missing. */
  function ownerOf(agent) {
    let header = agent.session.header
    while (header.origin === 'subagent') {
      const parent = header.parentSession === undefined ? undefined : ctx.agents.get(header.parentSession)
      if (parent === undefined) return undefined
      header = parent.session.header
    }
    return header.id
  }

  /** The session's next model: a pending picker choice, else its latest request. */
  function currentRoute(sessionId) {
    const session = ctx.agents.get(sessionId)?.session
    if (session === undefined) return undefined
    const selection = ctx.get('sessionProjections')?.stateOf(session, 'modelSelection')
    const route = selection?.pending ?? selection?.lastUsed ?? session.requestHeader()?.config
    return route === undefined || route === null ? undefined : route
  }

  /**
   * Whether a route's model offers a reasoning effort. The session can switch
   * to a model without it after the effort was chosen; any other resolution
   * failure is left for the request itself to report.
   */
  async function offersEffort(route, reasoningEffort) {
    try {
      await ctx.llm.resolveCallConfig({ provider: route.provider, model: route.model, reasoningEffort })
      return true
    } catch (error) {
      return error?.code !== 'UNSUPPORTED_REASONING_EFFORT'
    }
  }

  /** The route a subagent must use now, or undefined to leave it untouched. */
  async function targetFor(agent) {
    if (agent.session.header.origin !== 'subagent') return undefined
    const owner = ownerOf(agent)
    const override = owner === undefined ? undefined : overrides.get(owner)
    if (override === undefined) return undefined
    if (override.mode === 'custom') return override
    const route = currentRoute(owner)
    if (route === undefined || override.reasoningEffort === undefined) return route
    // A chosen effort the session's current model lacks falls back to following it.
    return await offersEffort(route, override.reasoningEffort) ? { ...route, reasoningEffort: override.reasoningEffort } : route
  }

  // Prompt assembly runs before each request: decide the route once per step so
  // the {{provider}}/{{model}} prompt variables and the request always agree.
  const assembled = new WeakMap()
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const agent = context.agent
    const target = agent === undefined ? undefined : await targetFor(agent)
    if (agent !== undefined) assembled.set(agent, target)
    const result = await next()
    if (target === undefined) return result
    return { ...result, variables: { ...result.variables, provider: target.provider, model: target.model } }
  })
  ctx.on('agent/request', async ({ agent }, next) => {
    const resolved = await next()
    const target = assembled.has(agent) ? assembled.get(agent) : await targetFor(agent)
    if (target === undefined) return resolved
    const { reasoningEffort: _effort, ...rest } = resolved
    return {
      ...rest,
      provider: target.provider,
      model: target.model,
      ...target.reasoningEffort === undefined ? {} : { reasoningEffort: target.reasoningEffort },
    }
  })

  const endpoints = {
    async get(payload) {
      const { sessionId } = requestSchema.parse(payload)
      return { override: overrides.get(sessionId) ?? null }
    },
    async set(payload, signal) {
      const { sessionId, override } = setRequestSchema.parse(payload)
      if (ctx.agents.get(sessionId)?.session.header.origin === 'subagent') {
        throw new Error('subagent sessions follow their top-level session')
      }
      if (override === null) {
        await overrides.delete(sessionId)
        return { override: null }
      }
      let stored = override
      if (override.mode === 'custom') {
        const config = await ctx.llm.resolveCallConfig({
          provider: override.provider,
          model: override.model,
          ...override.reasoningEffort === undefined ? {} : { reasoningEffort: override.reasoningEffort },
        }, signal)
        stored = {
          mode: 'custom',
          provider: config.provider,
          model: config.model,
          ...config.reasoningEffort === undefined ? {} : { reasoningEffort: String(config.reasoningEffort) },
        }
      } else if (override.reasoningEffort !== undefined) {
        const route = currentRoute(sessionId)
        if (route !== undefined && !await offersEffort(route, override.reasoningEffort)) {
          throw new Error(`model ${route.provider}/${route.model} does not support reasoning effort "${override.reasoningEffort}"`)
        }
      }
      await overrides.put(sessionId, stored)
      return { override: stored }
    },
  }

  for (const [endpoint, handler] of Object.entries(endpoints)) {
    ctx.connection.fetch.register({
      path: `${ROUTE_PREFIX}/${endpoint}`,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          return Response.json({ ok: true, value: await handler(await request.json(), request.signal) })
        } catch (error) {
          return Response.json({ ok: false, error: { message: error instanceof Error ? error.message : String(error) } })
        }
      },
    })
  }
}
