// examples/refund-order/agents.ts
// Example LangGraph / AutoGen style agents (plug into real framework)

import { AssistantAgent } from "autogen_agentchat.agents" // or LangGraph equivalent

export const primaryAgent = new AssistantAgent({
  name: "Primary",
  system_message: "You are the primary agent. Always return structured action + parameters.",
  model_client: /* your model client */
})

export const shadowAgent = new AssistantAgent({
  name: "Shadow",
  system_message: "You are the shadow agent. Cross-check the primary output.",
  model_client: /* your model client */
})

export async function runRefundWorkflow(goal: string) {
  const primary = await primaryAgent.run(goal)
  const shadow = await shadowAgent.run(goal)
  return { primary, shadow }
}