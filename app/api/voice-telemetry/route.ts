/**
 * Voice Interaction Telemetry — ingest endpoint.
 * HTTP transport layer only — persistence lives in:
 *   lib/server/services/telemetry/voice-interaction-service.ts
 *
 * docs/features/19_voice_telemetry.md §6
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError, withErrorHandler, parseBody } from '@/lib/shared/utils/api';
import { getAuthenticatedUser } from '@/lib/server/services/auth';
import { recordVoiceInteraction } from '@/lib/server/services/telemetry/voice-interaction-service';

// nodejs (not edge): shares the Prisma singleton, which needs a Node runtime.
export const runtime = 'nodejs';

const MatchingTierSchema = z.enum(['exact', 'phonetic', 'fuzzy', 'semantic', 'none']);
const ConfirmationRouteSchema = z.enum(['auto', 'confirmed', 'batch', 'abandoned']);

const VoiceInteractionMetricsSchema = z.object({
  requestId: z.string().min(1),

  vadStartAt: z.string().datetime().optional(),
  recordingStopAt: z.string().datetime().optional(),
  uploadCompleteAt: z.string().datetime().optional(),
  transcriptionStartAt: z.string().datetime().optional(),
  transcriptionEndAt: z.string().datetime().optional(),
  llmParseStartAt: z.string().datetime().optional(),
  llmParseEndAt: z.string().datetime().optional(),
  matchingStartAt: z.string().datetime().optional(),
  matchingEndAt: z.string().datetime().optional(),
  confirmShownAt: z.string().datetime().optional(),
  confirmReceivedAt: z.string().datetime().optional(),
  dbWriteAckAt: z.string().datetime().optional(),

  confirmationRoute: ConfirmationRouteSchema.optional(),

  webSttTranscript: z.string().optional(),
  whisperTranscript: z.string().optional(),
  matchedEntityValue: z.string().optional(),
  matchingTierUsed: MatchingTierSchema.optional(),
});

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError('Unauthorized', 401);

  const bodyResult = await parseBody(req, VoiceInteractionMetricsSchema);
  if (!bodyResult.success) {
    return bodyResult.errorResponse;
  }

  // Fire-and-forget from the client's perspective, but this handler still
  // awaits the write — recordVoiceInteraction itself never throws, so this
  // can't turn into a 500 from a DB hiccup.
  await recordVoiceInteraction(bodyResult.data);

  return apiSuccess({ recorded: true }, 200);
});
