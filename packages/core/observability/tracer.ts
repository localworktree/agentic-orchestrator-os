// packages/core/observability/tracer.ts
// OpenTelemetry + Lineage Tracing

import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"

export function initObservability(serviceName = "agentic-orchestrator") {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0"
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  })
  sdk.start()
  console.log("[OTEL] Observability initialized")
  return sdk
}

export function createSpan(name: string, attributes: Record<string, any> = {}) {
  // In real code: use @opentelemetry/api tracer
  console.log(`[TRACE] ${name}`, attributes)
}