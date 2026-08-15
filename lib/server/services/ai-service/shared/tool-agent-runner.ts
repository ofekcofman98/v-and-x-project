/**
 * Shared tool-calling loop for the Grid Agent and Global Agent
 * (docs/features/03_ai_table_agent.md §4). Both agents share an identical
 * round loop, usage accumulation, and message bookkeeping; the only genuine
 * difference between them is *how a tool call is validated and executed* —
 * grid-agent fixes `tableId` server-side as a turn constant, global-agent
 * takes it as a model-supplied argument validated against a resolved
 * BaseList's table set. That difference is captured entirely by the
 * `handleToolCall` callback each agent supplies; this module owns nothing
 * table- or column-specific.
 */

import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { openai } from './openai-client';
import { AI_MODELS, AI_LIMITS } from './config';
import { accumulateUsage, type AgentUsage } from './usage';

/**
 * The result of dispatching one tool call:
 * - `result` — the tool executed; its JSON is sent back to the model and the
 *   loop continues to the next round.
 * - `correction` — the call's arguments were invalid (bad JSON, unknown
 *   column/table); the message is sent back as a tool result and burns one
 *   of the turn's bounded correction rounds instead of a real tool round.
 * - `terminate` — end the turn right now with this response (the
 *   `updateCellsBatch` proposal path: it is cached and returned immediately,
 *   never executed mid-conversation).
 */
export type ToolCallOutcome<TResponse> =
  | { kind: 'result'; content: string }
  | { kind: 'correction'; content: string }
  | { kind: 'terminate'; response: TResponse };

export interface RunToolAgentParams<TResponse> {
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  tools: ChatCompletionTool[];
  /** Validates + executes (or proposes) one tool call. */
  handleToolCall: (name: string, rawArgs: string) => Promise<ToolCallOutcome<TResponse>>;
  /** Builds the final response when the model returns a plain text answer (no tool call). */
  buildFinalAnswer: (content: string) => TResponse;
  /** Builds the response returned when the correction-round budget is exhausted. */
  buildCorrectionLimitAnswer: () => TResponse;
  /** Builds the response returned when MAX_TOOL_ROUNDS is exhausted without a final answer. */
  buildExhaustedAnswer: () => TResponse;
  maxToolRounds?: number;
  maxCorrectionRounds?: number;
}

export interface RunToolAgentResult<TResponse> {
  response: TResponse;
  usage: AgentUsage;
}

export async function runToolAgent<TResponse>(
  params: RunToolAgentParams<TResponse>
): Promise<RunToolAgentResult<TResponse>> {
  const {
    systemPrompt,
    history,
    message,
    tools,
    handleToolCall,
    buildFinalAnswer,
    buildCorrectionLimitAnswer,
    buildExhaustedAnswer,
    maxToolRounds = AI_LIMITS.MAX_TOOL_ROUNDS,
    maxCorrectionRounds = AI_LIMITS.MAX_CORRECTION_ROUNDS,
  } = params;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatCompletionMessageParam),
    { role: 'user', content: message },
  ];

  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0 };
  let correctionRounds = 0;

  for (let round = 0; round < maxToolRounds; round++) {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages,
      tools,
      tool_choice: 'auto',
    });

    accumulateUsage(usage, {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) throw new Error('LLM returned no message');

    const toolCalls = responseMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { response: buildFinalAnswer(responseMessage.content ?? ''), usage };
    }

    messages.push({
      role: 'assistant',
      content: responseMessage.content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue;
      const { name, arguments: rawArgs } = toolCall.function;

      const outcome = await handleToolCall(name, rawArgs);

      if (outcome.kind === 'correction') {
        correctionRounds++;
        if (correctionRounds > maxCorrectionRounds) {
          return { response: buildCorrectionLimitAnswer(), usage };
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: outcome.content });
        continue;
      }

      if (outcome.kind === 'terminate') {
        return { response: outcome.response, usage };
      }

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: outcome.content });
    }
  }

  return { response: buildExhaustedAnswer(), usage };
}
