// packages/core/security/mac.ts
// SEAgent-style Mandatory Access Control + Risk Engine

import type { Redis } from "ioredis"
import type { RequestState, AgentOutput } from "@agentic/types"

export interface Policy {
  tool: string
  action: string
  risk: "low" | "medium" | "high"
  requires_approval: boolean
  allowed_roles: string[]
}

export class SecurityEngine {
  private redis: Redis
  private policies: Map<string, Policy> = new Map()

  constructor(redis: Redis) {
    this.redis = redis
    this.loadPolicies()
  }

  private async loadPolicies() {
    // In production: load from Redis or policy service
    this.policies.set("refund_payment", {
      tool: "refund_payment",
      action: "refund",
      risk: "high",
      requires_approval: true,
      allowed_roles: ["finance", "admin"]
    })
  }

  async evaluateAction(
    request: RequestState,
    output: AgentOutput
  ): Promise<{ allowed: boolean; reason?: string; requiresHuman: boolean }> {
    const policy = this.policies.get(output.action)
    if (!policy) return { allowed: true, requiresHuman: false }

    if (policy.risk === "high" && request.risk_level !== "high") {
      return { allowed: false, reason: "High-risk action on low-risk request", requiresHuman: true }
    }

    if (policy.requires_approval) {
      return { allowed: false, reason: "Requires human approval", requiresHuman: true }
    }

    return { allowed: true, requiresHuman: false }
  }

  async logViolation(requestId: string, reason: string) {
    await this.redis.xadd("stream:security", "*", "request_id", requestId, "violation", reason, "ts", Date.now().toString())
  }
}