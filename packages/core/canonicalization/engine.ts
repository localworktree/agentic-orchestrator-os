// packages/core/canonicalization/engine.ts
// Production Pluggable Canonicalization Engine v2.1
// Hot-reloadable • Versioned • Tool-aware • Auto-learning ready

import crypto from "crypto"
import { z } from "zod"
import type { Redis } from "ioredis"
import type { CanonicalIntent, CanonicalizationConfig, ToolRule } from "@agentic/types"

const CanonicalIntentSchema = z.object({
  action: z.string(),
  target: z.string().nullable(),
  parameters: z.record(z.any())
})

export class CanonicalizationEngine {
  private redis: Redis
  private cache = new Map<string, CanonicalizationConfig>()

  constructor(redis: Redis) {
    this.redis = redis
  }

  async canonicalize(
    raw: any,
    tool: string
  ): Promise<{ canonical: CanonicalIntent; intent_hash: string; version: string }> {
    const config = await this.loadConfig()
    const coerced = this.coerce(raw)
    const normalized = this.normalize(coerced, config)
    const toolAdjusted = this.applyToolRules(normalized, tool, config)
    const serialized = this.stableStringify(toolAdjusted)
    const intent_hash = crypto.createHash("sha256").update(serialized).digest("hex")

    return {
      canonical: toolAdjusted,
      intent_hash,
      version: config.version
    }
  }

  private async loadConfig(): Promise<CanonicalizationConfig> {
    const version = (await this.redis.get("canonical:active_version")) || "v1"
    const cacheKey = `config:${version}`

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const [actionsRaw, fieldsRaw, toolRulesRaw] = await Promise.all([
      this.redis.get(`canonical:actions:${version}`),
      this.redis.get(`canonical:fields:${version}`),
      this.redis.get(`canonical:tool_rules:${version}`)
    ])

    const config: CanonicalizationConfig = {
      version,
      actionMap: this.invertMap(actionsRaw ? JSON.parse(actionsRaw) : {}),
      fieldMap: this.invertMap(fieldsRaw ? JSON.parse(fieldsRaw) : {}),
      toolRules: toolRulesRaw ? JSON.parse(toolRulesRaw) : {}
    }

    this.cache.set(cacheKey, config)
    return config
  }

  private invertMap(map: Record<string, string[]>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [canonical, variants] of Object.entries(map)) {
      for (const v of variants) {
        out[v.toLowerCase()] = canonical
      }
    }
    return out
  }

  private coerce(raw: any): CanonicalIntent {
    return {
      action: raw.action || raw.operation || raw.type || "",
      target: raw.target || raw.id || raw.user_id || null,
      parameters: raw.parameters || {}
    }
  }

  private normalize(intent: CanonicalIntent, config: CanonicalizationConfig): CanonicalIntent {
    return {
      action: config.actionMap[intent.action.toLowerCase()] || intent.action,
      target: intent.target,
      parameters: this.normalizeParams(intent.parameters, config)
    }
  }

  private normalizeParams(params: any, config: CanonicalizationConfig): any {
    if (typeof params !== "object" || params === null) return params
    const out: any = {}
    for (const [k, v] of Object.entries(params)) {
      const key = config.fieldMap[k] || k
      out[key] = typeof v === "object" ? this.normalizeParams(v, config) : this.normalizeValue(v)
    }
    return out
  }

  private normalizeValue(value: any): any {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true
      if (value.toLowerCase() === "false") return false
      if (/^\d+$/.test(value)) return Number(value)
    }
    return value
  }

  private applyToolRules(
    intent: CanonicalIntent,
    tool: string,
    config: CanonicalizationConfig
  ): CanonicalIntent {
    const rules = config.toolRules[tool] as ToolRule | undefined
    if (!rules) return intent

    let updated = { ...intent }

    for (const rule of rules.normalize || []) {
      if (rule === "strip_prefix:user_" && updated.target) {
        updated.target = updated.target.replace(/^user_/, "")
      }
      if (rule === "currency_to_number" && updated.parameters.amount) {
        updated.parameters.amount = Number(updated.parameters.amount)
      }
      if (rule === "lowercase_action") {
        updated.action = updated.action.toLowerCase()
      }
    }
    return updated
  }

  private stableStringify(obj: any): string {
    if (obj === null || typeof obj !== "object") return JSON.stringify(obj)
    if (Array.isArray(obj)) return `[${obj.map(v => this.stableStringify(v)).join(",")}]`
    const keys = Object.keys(obj).sort()
    return `{${keys.map(k => `"${k}":${this.stableStringify(obj[k])}`).join(",")}}`
  }

  // === Hot Reload & Versioning ===
  async setActiveVersion(version: string) {
    await this.redis.set("canonical:active_version", version)
    this.cache.clear()
  }

  async promoteStagingToVersion(fromVersion: string, toVersion: string) {
    const staging = await this.redis.get(`canonical:staging:${fromVersion}`)
    if (!staging) throw new Error("No staging config found")

    await this.redis.set(`canonical:actions:${toVersion}`, JSON.stringify(JSON.parse(staging).actions))
    await this.redis.set(`canonical:fields:${toVersion}`, JSON.stringify(JSON.parse(staging).fields))
    await this.redis.set("canonical:active_version", toVersion)
    this.cache.clear()
  }
}