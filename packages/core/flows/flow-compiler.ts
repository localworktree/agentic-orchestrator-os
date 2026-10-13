// packages/core/flows/flow-compiler.ts
// Autonomous Flow Compilation + Parameter Binding

import type { Redis } from "ioredis"
import type { FlowDefinition, FlowStep, GoalPlan, PlanStep } from "@agentic/types"
import { IntentMemoryGraph } from "../graph/intent-memory-graph"

export class FlowCompiler {
  private redis: Redis
  private graph: IntentMemoryGraph

  constructor(redis: Redis) {
    this.redis = redis
    this.graph = new IntentMemoryGraph(redis)
  }

  async synthesizePlan(goal: string, goalHash: string): Promise<GoalPlan> {
    // 1. Check for known compiled flows
    const knownFlow = await this.graph.getFlow(goalHash)
    if (knownFlow) {
      return {
        plan_id: `plan_${Date.now()}`,
        goal_hash: goalHash,
        steps: knownFlow.steps.map(s => ({
          type: "flow",
          flow_id: knownFlow.flow_id,
          requires_quorum: knownFlow.risk_level === "high"
        })),
        source: "compiled",
        confidence: knownFlow.confidence,
        created_at: Date.now()
      }
    }

    // 2. Fallback to hybrid (predict + generate)
    const predicted = await this.graph.predictNext(goalHash)
    const steps: PlanStep[] = []

    if (predicted) {
      steps.push({ type: "flow", flow_id: predicted.to, requires_quorum: false, estimated_latency: 800 })
    } else {
      steps.push({ type: "intent", intent_hash: goalHash, requires_quorum: true, estimated_latency: 2500 })
    }

    return {
      plan_id: `plan_${Date.now()}`,
      goal_hash: goalHash,
      steps,
      source: predicted ? "hybrid" : "generated",
      confidence: predicted ? 0.88 : 0.65,
      created_at: Date.now()
    }
  }

  async bindParameters(step: FlowStep, input: Record<string, any>): Promise<Record<string, any>> {
    if (!step.parameters_template) return input
    let templateStr = JSON.stringify(step.parameters_template)
    for (const [key, value] of Object.entries(input)) {
      templateStr = templateStr.replace(new RegExp(`{{${key}}}`, "g"), String(value))
    }
    return JSON.parse(templateStr)
  }

  async executeFlow(flowId: string, input: Record<string, any>) {
    const flow = await this.redis.get(`flow:def:${flowId}`)
    if (!flow) throw new Error("Flow not found")

    const def: FlowDefinition = JSON.parse(flow)
    for (const step of def.steps) {
      const params = await this.bindParameters(step, input)
      console.log(`[FLOW] Executing ${step.action} with`, params)
      // In production: call actual tool / agent
    }
  }
}