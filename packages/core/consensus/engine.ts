// packages/core/consensus/engine.ts
// Hybrid Consensus Engine — Deterministic + Semantic

import type { Redis } from "ioredis"
import type { AgentOutput, ConsensusState, RequestState } from "@agentic/types"
import { CanonicalizationEngine } from "../canonicalization/engine"
import { IntentMemoryGraph } from "../graph/intent-memory-graph"
import OpenAI from "openai"

export class ConsensusEngine {
  private redis: Redis
  private canonical: CanonicalizationEngine
  private graph: IntentMemoryGraph
  private openai: OpenAI

  constructor(redis: Redis) {
    this.redis = redis
    this.canonical = new CanonicalizationEngine(redis)
    this.graph = new IntentMemoryGraph(redis)
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async reachConsensus(
    requestId: string,
    primary: AgentOutput,
    shadow: AgentOutput
  ): Promise<ConsensusState> {
    const [primaryHash, shadowHash] = await Promise.all([
      this.canonical.canonicalize(primary, "default"),
      this.canonical.canonicalize(shadow, "default")
    ])

    let agreement = primaryHash.intent_hash === shadowHash.intent_hash
    let divergenceScore = 0
    let resolvedBy: "direct_match" | "meta_resolved" | "unresolved" = "direct_match"
    let metaUsed = false

    if (!agreement) {
      divergenceScore = await this.calculateDivergence(primary, shadow)
      if (divergenceScore > 0.85) {
        const similarity = await this.semanticSimilarity(primaryHash.intent_hash, shadowHash.intent_hash)
        if (similarity > 0.94) {
          agreement = true
          resolvedBy = "direct_match"
        } else if (similarity > 0.85) {
          resolvedBy = "unresolved"
        } else {
          metaUsed = true
          resolvedBy = "meta_resolved"
          // In production: trigger Meta agent here
        }
      }
    }

    const state: ConsensusState = {
      request_id: requestId,
      agreement,
      divergence_score: divergenceScore,
      compared_agents: ["primary", "shadow"],
      resolved_by: resolvedBy,
      meta_agent_used: metaUsed,
      created_at: Date.now()
    }

    await this.redis.set(`consensus:${requestId}`, JSON.stringify(state))
    await this.graph.recordTransition(primaryHash.intent_hash, shadowHash.intent_hash, agreement)

    return state
  }

  private async calculateDivergence(a: AgentOutput, b: AgentOutput): Promise<number> {
    // Simple structural + semantic divergence (0-1)
    let score = 0
    if (a.action !== b.action) score += 0.4
    if (JSON.stringify(a.parameters) !== JSON.stringify(b.parameters)) score += 0.4
    if (a.confidence < 0.7 || b.confidence < 0.7) score += 0.2
    return Math.min(1, score)
  }

  private async semanticSimilarity(hashA: string, hashB: string): Promise<number> {
    const cacheKey = `similarity:${hashA}:${hashB}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return parseFloat(cached)

    const [embA, embB] = await Promise.all([
      this.getEmbedding(hashA),
      this.getEmbedding(hashB)
    ])

    const sim = this.cosineSimilarity(embA, embB)
    await this.redis.set(cacheKey, sim.toString(), "EX", 3600)
    return sim
  }

  private async getEmbedding(intentHash: string): Promise<number[]> {
    const cached = await this.redis.get(`embedding:${intentHash}`)
    if (cached) return JSON.parse(cached)

    const text = `intent:${intentHash}`
    const res = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    })
    const vector = res.data[0].embedding
    await this.redis.set(`embedding:${intentHash}`, JSON.stringify(vector), "EX", 86400)
    return vector
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}