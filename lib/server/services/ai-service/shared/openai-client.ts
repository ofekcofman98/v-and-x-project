/**
 * Central OpenAI client singleton for every AI/voice service in
 * lib/server/services/. Kept as a plain `new OpenAI(...)` instance
 * constructed at module load — several tests (grid-agent.test.ts,
 * global-agent.test.ts, stt-service/transcribe.test.ts) mock the `openai`
 * package's default export directly and assert on the args passed to
 * `chat.completions.create`, so this must stay an exported client instance,
 * not a wrapper function.
 */

import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
