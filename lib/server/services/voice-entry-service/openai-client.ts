// Re-exports the central OpenAI client singleton — kept as its own module so
// existing `vi.mock('./openai-client')` call sites in this folder's tests
// keep working unchanged. See lib/server/services/ai-service/shared/openai-client.ts.
export { openai } from '@/lib/server/services/ai-service/shared/openai-client';
