/** Accumulated OpenAI token usage across a — possibly multi-round — agent turn. */
export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export function accumulateUsage(
  usage: AgentUsage,
  result: { promptTokens: number; completionTokens: number }
): void {
  usage.inputTokens += result.promptTokens;
  usage.outputTokens += result.completionTokens;
}
