// packages/core/stores/redis.ts
// Zero-magic-string Redis access layer

import type { Redis } from "ioredis"
import type {
  RequestState,
  AgentOutput,
  ConsensusState,
  LineageRecord,
  TrustScoreRecord,
  SystemEvent,
  CommitLock,
  SandboxBuffer
} from "@agentic/types"

export class RequestStore {
  constructor(private redis: Redis) {}

  async create(request: RequestState) {
    await this.redis.set(`request:${request.request_id}`, JSON.stringify(request))
    await this.redis.set(`request:status:${request.request_id}`, request.status)
  }

  async get(requestId: string): Promise<RequestState | null> {
    const data = await this.redis.get(`request:${requestId}`)
    return data ? JSON.parse(data) : null
  }

  async updateStatus(requestId: string, status: RequestState["status"]) {
    const req = await this.get(requestId)
    if (!req) return
    req.status = status
    req.updated_at = Date.now()
    await this.redis.set(`request:${requestId}`, JSON.stringify(req))
    await this.redis.set(`request:status:${requestId}`, status)
  }
}

export class AgentOutputStore {
  constructor(private redis: Redis) {}

  async save(output: AgentOutput) {
    await this.redis.set(
      `agent_output:${output.request_id}:${output.agent_type}`,
      JSON.stringify(output)
    )
  }

  async get(requestId: string, agentType: string): Promise<AgentOutput | null> {
    const data = await this.redis.get(`agent_output:${requestId}:${agentType}`)
    return data ? JSON.parse(data) : null
  }
}

export class ConsensusStore {
  constructor(private redis: Redis) {}

  async save(state: ConsensusState) {
    await this.redis.set(`consensus:${state.request_id}`, JSON.stringify(state))
  }

  async get(requestId: string): Promise<ConsensusState | null> {
    const data = await this.redis.get(`consensus:${requestId}`)
    return data ? JSON.parse(data) : null
  }
}

export class EventStore {
  constructor(private redis: Redis) {}

  async publish(event: SystemEvent) {
    await this.redis.xadd(
      "stream:events",
      "*",
      "request_id", event.request_id,
      "type", event.type,
      "payload", JSON.stringify(event.payload || {}),
      "timestamp", event.timestamp.toString()
    )
  }

  async getRecent(requestId: string, count = 20) {
    const events = await this.redis.xrevrange("stream:events", "+", "-", "COUNT", count)
    return events.filter(e => e[1].request_id === requestId)
  }
}

export class CommitLockStore {
  constructor(private redis: Redis) {}

  async acquire(requestId: string, lockedBy: string, phase: "soft" | "final"): Promise<boolean> {
    const key = `lock:commit:${requestId}`
    const result = await this.redis.set(key, JSON.stringify({ request_id: requestId, locked_by: lockedBy, phase, acquired_at: Date.now() }), "NX", "EX", 300)
    return result === "OK"
  }

  async release(requestId: string) {
    await this.redis.del(`lock:commit:${requestId}`)
  }
}