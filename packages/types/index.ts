// packages/types/index.ts
// Complete type system for Agentic Orchestration OS v1.0

export type RequestStatus =
  | "pending"
  | "running"
  | "awaiting_consensus"
  | "resolved"
  | "failed"
  | "aborted"

export type RouteType = "fast" | "quorum"

export type AgentType = "primary" | "shadow" | "meta" | "validator"

export type RiskLevel = "low" | "medium" | "high"

export type CommitPhase = "none" | "soft" | "verified" | "final"

export type ConsensusResolution = "direct_match" | "meta_resolved" | "unresolved"

export type EventType =
  | "REQUEST_CREATED"
  | "TRUST_COMPUTED"
  | "ROUTE_SELECTED"
  | "AGENT_STARTED"
  | "AGENT_COMPLETED"
  | "CONSENSUS_STARTED"
  | "CONSENSUS_REACHED"
  | "META_TRIGGERED"
  | "META_RESOLVED"
  | "COMMIT_SOFT"
  | "COMMIT_VERIFIED"
  | "COMMIT_FINAL"
  | "COMMIT_ABORTED"
  | "FLOW_COMPILED"
  | "FLOW_EXECUTED"
  | "GOAL_SYNTHESIZED"
  | "ERROR"

export interface DecisionBasisItem {
  key: string
  value: string | number | boolean
  confidence?: number
}

export interface RequestState {
  request_id: string
  user_id?: string
  status: RequestStatus
  route: RouteType
  trust_score: number
  risk_level: RiskLevel
  created_at: number
  updated_at: number
  commit_phase: CommitPhase
  lineage_id: string
  goal?: string
  final_action?: string
  final_parameters?: Record<string, any>
}

export interface AgentOutput {
  request_id: string
  agent_id: string
  agent_type: AgentType
  model: string
  model_version?: string
  action: string
  parameters: Record<string, any>
  intent_hash: string
  decision_basis: DecisionBasisItem[]
  confidence: number
  flags?: {
    prompt_injection?: boolean
    schema_mismatch?: boolean
    unsafe_action?: boolean
    resource_pressure?: boolean
  }
  latency_ms: number
  created_at: number
}

export interface ConsensusState {
  request_id: string
  agreement: boolean
  divergence_score: number
  compared_agents: AgentType[]
  final_action?: string
  final_parameters?: Record<string, any>
  resolved_by: ConsensusResolution
  meta_agent_used: boolean
  created_at: number
  resolved_at?: number
}

export interface LineageStep {
  step: number
  agent_type?: AgentType
  action?: string
  intent_hash?: string
  timestamp: number
}

export interface LineageRecord {
  request_id: string
  root_prompt_hash: string
  plan_hash?: string
  steps: LineageStep[]
  trust_history: number[]
  created_at: number
}

export interface TrustScoreRecord {
  request_id: string
  score: number
  components: {
    input_entropy: number
    model_confidence: number
    schema_alignment: number
    historical_success: number
    tool_risk: number
  }
  threshold_used: number
  created_at: number
}

export interface SystemEvent {
  request_id: string
  type: EventType
  agent_type?: AgentType
  payload?: Record<string, any>
  timestamp: number
}

export interface CommitLock {
  request_id: string
  locked_by: string
  phase: "soft" | "final"
  acquired_at: number
}

export interface SandboxBuffer {
  request_id: string
  proposed_action: string
  proposed_parameters: Record<string, any>
  validated: boolean
  created_at: number
}

export interface DivergenceDetail {
  field: string
  primary_value: any
  shadow_value: any
  severity: number
}

export interface DivergenceReport {
  request_id: string
  details: DivergenceDetail[]
  score: number
  created_at: number
}

export interface CanonicalIntent {
  action: string
  target: string | null
  parameters: Record<string, any>
}

export interface CanonicalizationConfig {
  version: string
  actionMap: Record<string, string>
  fieldMap: Record<string, string>
  toolRules: Record<string, ToolRule>
}

export interface ToolRule {
  required_fields?: string[]
  normalize?: string[]
}

export interface IntentNode {
  intent_hash: string
  action: string
  tool: string
  occurrence_count: number
  last_seen: number
  success_rate: number
}

export interface IntentEdge {
  from_hash: string
  to_hash: string
  weight: number
  success_rate: number
  avg_latency: number
  last_seen: number
}

export interface FlowDefinition {
  flow_id: string
  trigger_intent: string
  steps: FlowStep[]
  confidence: number
  success_rate: number
  avg_latency: number
  compiled_at: number
  risk_level: RiskLevel
}

export interface FlowStep {
  type: "flow" | "intent"
  flow_id?: string
  intent_hash?: string
  action: string
  tool: string
  parameters_template: Record<string, any>
  bindings?: Record<string, string>
}

export interface GoalPlan {
  plan_id: string
  goal_hash: string
  steps: PlanStep[]
  source: "compiled" | "generated" | "hybrid"
  confidence: number
  created_at: number
}

export interface PlanStep {
  type: "flow" | "intent"
  flow_id?: string
  intent_hash?: string
  requires_quorum: boolean
  estimated_latency: number
}