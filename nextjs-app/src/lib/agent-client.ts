const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function executeAgent(agentType: string, inputData: Record<string, unknown>, repositoryId?: string, executionId?: string) {
  const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/agents/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_type: agentType, input_data: inputData, repository_id: repositoryId, execution_id: executionId }),
  });
  if (!res.ok) throw new Error(`Agent service error: ${res.status}`);
  return res.json();
}

export async function getAgentStatus(executionId: string) {
  const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/agents/status/${executionId}`);
  if (!res.ok) throw new Error(`Agent service error: ${res.status}`);
  return res.json();
}

export async function getAgentResults(executionId: string) {
  const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/agents/results/${executionId}`);
  if (!res.ok) throw new Error(`Agent service error: ${res.status}`);
  return res.json();
}
