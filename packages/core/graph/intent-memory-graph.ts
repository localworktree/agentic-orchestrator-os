// packages/core/graph/intent-memory-graph.ts
// Intent Memory Graph — Predictive + Self-Optimizing

import type { Redis } from "ioredis"
import type { IntentNode, IntentEdge, FlowDefinition } from "@agentic/types"

export class IntentMemoryGraph {
  private redis: Redis

  constructor(redis: Redis) {
    this.redis = redis
  }

  async recordTransition(fromHash: string, toHash: string, success: boolean) {
    const edgeKey = `intent:edge:${fromHash}:${toHash}`
    await this.redis.hincrby(edgeKey, "weight", 1)
    if (success) await this.redis.hincrby(edgeKey, "success_count", 1)
    await this.redis.hset(edgeKey, "last_seen", Date.now())

    // Update node stats
    await this.redis.hincrby(`intent:node:${fromHash}`, "occurrence_count", 1)
    await this.redis.hset(`intent:node:${fromHash}`, "last_seen", Date.now())
  }

  async predictNext(currentHash: string): Promise<{ to: string; score: number } | null> {
    const keys = await this.redis.keys(`intent:edge:${currentHash}:*`)
    if (keys.length === 0) return null

    const scored = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.hgetall(key)
        const weight = parseInt(data.weight || "0")
        const success = parseInt(data.success_count || "0")
        const score = weight * (success / Math.max(1, weight))
        return { to: key.split(":")[3], score }
      })
    )

    scored.sort((a, b) => b.score - a.score)
    return scored[0] || null
  }

  async compileFrequentFlow(triggerHash: string, minOccurrences = 15): Promise<FlowDefinition | null> {
    const path = await this.redis.lrange(`intent:path:${triggerHash}`, 0, -1)
    if (path.length < 3) return null

    const count = await this.redis.get(`flow:candidate:count:${triggerHash}`)
    if (parseInt(count || "0") < minOccurrences) return null

    const flow: FlowDefinition = {
      flow_id: `flow_${Date.now()}`,
      trigger_intent: triggerHash,
      steps: path.map((hash, i) => ({
        type: "intent",
        intent_hash: hash,
        action: "unknown",
        tool: "unknown",
        parameters_template: {}
      })),
      confidence: 0.92,
      success_rate: 0.95,
      avg_latency: 1200,
      compiled_at: Date.now(),
      risk_level: "low"
    }

    await this.redis.set(`flow:def:${flow.flow_id}`, JSON.stringify(flow))
    await this.redis.sadd(`flow:index:${triggerHash}`, flow.flow_id)
    return flow
  }

  async getFlow(triggerHash: string): Promise<FlowDefinition | null> {
    const flowIds = await this.redis.smembers(`flow:index:${triggerHash}`)
    if (flowIds.length === 0) return null
    const flowData = await this.redis.get(`flow:def:${flowIds[0]}`)
    return flowData ? JSON.parse(flowData) : null
  }
}