-- CreateTable
CREATE TABLE "voice_interactions" (
    "id" UUID NOT NULL,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vad_start_at" TIMESTAMPTZ(6),
    "recording_stop_at" TIMESTAMPTZ(6),
    "upload_complete_at" TIMESTAMPTZ(6),
    "transcription_start_at" TIMESTAMPTZ(6),
    "transcription_end_at" TIMESTAMPTZ(6),
    "llm_parse_start_at" TIMESTAMPTZ(6),
    "llm_parse_end_at" TIMESTAMPTZ(6),
    "matching_start_at" TIMESTAMPTZ(6),
    "matching_end_at" TIMESTAMPTZ(6),
    "confirm_shown_at" TIMESTAMPTZ(6),
    "confirm_received_at" TIMESTAMPTZ(6),
    "db_write_ack_at" TIMESTAMPTZ(6),
    "recording_duration_ms" INTEGER,
    "transcription_duration_ms" INTEGER,
    "llm_parse_duration_ms" INTEGER,
    "matching_duration_ms" INTEGER,
    "confirm_wait_duration_ms" INTEGER,
    "total_duration_ms" INTEGER,
    "confirmation_route" TEXT,
    "web_stt_transcript" TEXT,
    "whisper_transcript" TEXT,
    "matched_entity_value" TEXT,
    "matching_tier_used" TEXT,

    CONSTRAINT "voice_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_interactions_request_id_key" ON "voice_interactions"("request_id");

-- CreateIndex
CREATE INDEX "voice_interactions_request_id_idx" ON "voice_interactions"("request_id");

-- CreateIndex
CREATE INDEX "voice_interactions_created_at_idx" ON "voice_interactions"("created_at");

-- Row Level Security: this table has no direct client access (writes go only
-- through lib/server/services/telemetry/voice-interaction-service.ts via the
-- Prisma service-role connection, which bypasses RLS). Deny-all policy is
-- defense-in-depth against any direct Supabase-client access (e.g. Realtime),
-- matching the convention in 20260718125500_enable_rls_policies.
ALTER TABLE "voice_interactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to voice_interactions"
  ON "voice_interactions"
  USING (false)
  WITH CHECK (false);
