// One-off analysis over voice_interactions (docs/features/19_voice_telemetry.md).
// Run with: npx tsx scripts/tmp-voice-telemetry-report.ts
//
import 'dotenv/config';
import { prisma } from '../lib/prisma';

// Marks when the current tuning landed locally: silenceDurationMs settled at
// 700ms (700→550 was tried and reverted — it cut off natural inter-entry
// breaths during batch dictation; see ui-store.ts), POST_SPEECH_PADDING_MS
// 200→150, and the LLM prompt trim (llm-prompts.ts). None of this is
// committed yet, so there's no commit timestamp to anchor on — this is a
// manual cutoff, set to "now" at the point the changes were considered live
// for testing. Bump it if you re-tune further and want a fresh baseline.
const OPTIMIZATION_CUTOFF_ISO = '2026-09-05T15:30:15.266Z';

async function main() {
  // 1. Latency percentiles (P50/P95) per pipeline stage, last 14 days.
  const latency = await prisma.$queryRawUnsafe<
    {
      n: bigint;
      p50_recording: number | null;
      p95_recording: number | null;
      p50_transcription: number | null;
      p95_transcription: number | null;
      p50_llm_parse: number | null;
      p95_llm_parse: number | null;
      p50_matching: number | null;
      p95_matching: number | null;
      p50_total: number | null;
      p95_total: number | null;
    }[]
  >(`
    select
      count(*) as n,
      percentile_cont(0.5)  within group (order by recording_duration_ms)     as p50_recording,
      percentile_cont(0.95) within group (order by recording_duration_ms)     as p95_recording,
      percentile_cont(0.5)  within group (order by transcription_duration_ms) as p50_transcription,
      percentile_cont(0.95) within group (order by transcription_duration_ms) as p95_transcription,
      percentile_cont(0.5)  within group (order by llm_parse_duration_ms)     as p50_llm_parse,
      percentile_cont(0.95) within group (order by llm_parse_duration_ms)     as p95_llm_parse,
      percentile_cont(0.5)  within group (order by matching_duration_ms)      as p50_matching,
      percentile_cont(0.95) within group (order by matching_duration_ms)      as p95_matching,
      percentile_cont(0.5)  within group (order by total_duration_ms)         as p50_total,
      percentile_cont(0.95) within group (order by total_duration_ms)         as p95_total
    from voice_interactions
    where created_at > now() - interval '14 days';
  `);
  console.log('--- Latency percentiles (ms), last 14 days ---');
  console.log(latency[0]);

  // 2. Breakdown by confirmation_route: volume + confirm-wait time.
  const byRoute = await prisma.$queryRawUnsafe<
    { confirmation_route: string | null; n: bigint; avg_confirm_wait_ms: number | null }[]
  >(`
    select
      confirmation_route,
      count(*) as n,
      avg(confirm_wait_duration_ms) as avg_confirm_wait_ms
    from voice_interactions
    where created_at > now() - interval '14 days'
    group by confirmation_route
    order by n desc;
  `);
  console.log('\n--- By confirmation_route, last 14 days ---');
  console.log(byRoute);

  // 3. Matching tier distribution (only populated with ENABLE_VOICE_ACCURACY_TELEMETRY=true).
  const byTier = await prisma.$queryRawUnsafe<
    { matching_tier_used: string | null; n: bigint }[]
  >(`
    select matching_tier_used, count(*) as n
    from voice_interactions
    where created_at > now() - interval '14 days'
    group by matching_tier_used
    order by n desc;
  `);
  console.log('\n--- Matching tier distribution, last 14 days ---');
  console.log(byTier);

  // 4. Rows where the Web Speech shadow transcript diverges from Whisper's —
  //    candidates for manual accuracy spot-checking.
  const divergent = await prisma.$queryRawUnsafe<
    { request_id: string; web_stt_transcript: string | null; whisper_transcript: string | null; matched_entity_value: string | null }[]
  >(`
    select request_id, web_stt_transcript, whisper_transcript, matched_entity_value
    from voice_interactions
    where web_stt_transcript is not null
      and whisper_transcript is not null
      and web_stt_transcript <> whisper_transcript
    order by created_at desc
    limit 20;
  `);
  console.log('\n--- Web STT vs Whisper divergence (spot-check candidates) ---');
  console.log(divergent);

  // 5. Most recent rows with the new trace fields (navigation_mode, was_batch,
  // targets) plus the accuracy columns, to confirm end-to-end capture after
  // enabling ENABLE_VOICE_ACCURACY_TELEMETRY.
  const recent = await prisma.$queryRawUnsafe<
    {
      request_id: string;
      confirmation_route: string | null;
      navigation_mode: string | null;
      was_batch: boolean | null;
      targets: unknown;
      matching_tier_used: string | null;
      whisper_transcript: string | null;
      web_stt_transcript: string | null;
      matched_entity_value: string | null;
    }[]
  >(`
    select
      request_id, confirmation_route, navigation_mode, was_batch, targets,
      matching_tier_used, whisper_transcript, web_stt_transcript, matched_entity_value
    from voice_interactions
    order by created_at desc
    limit 5;
  `);
  console.log('\n--- Most recent rows (trace + accuracy fields) ---');
  console.log(recent);

  // 6. Untainted latency baseline: only rows created after the VAD + LLM
  // prompt-trim optimizations landed (see OPTIMIZATION_CUTOFF_ISO above).
  // The 14-day window above is dominated by pre-optimization rows, so its
  // percentiles don't move even when the changes work — this isolates the
  // post-change population. `n` will be small right after landing; treat
  // percentiles as directional, not conclusive, until it grows.
  const postOptimization = await prisma.$queryRawUnsafe<
    {
      n: bigint;
      p50_recording: number | null;
      p95_recording: number | null;
      p50_transcription: number | null;
      p95_transcription: number | null;
      p50_llm_parse: number | null;
      p95_llm_parse: number | null;
      p50_total: number | null;
      p95_total: number | null;
    }[]
  >(`
    select
      count(*) as n,
      percentile_cont(0.5)  within group (order by recording_duration_ms)     as p50_recording,
      percentile_cont(0.95) within group (order by recording_duration_ms)     as p95_recording,
      percentile_cont(0.5)  within group (order by transcription_duration_ms) as p50_transcription,
      percentile_cont(0.95) within group (order by transcription_duration_ms) as p95_transcription,
      percentile_cont(0.5)  within group (order by llm_parse_duration_ms)     as p50_llm_parse,
      percentile_cont(0.95) within group (order by llm_parse_duration_ms)     as p95_llm_parse,
      percentile_cont(0.5)  within group (order by total_duration_ms)         as p50_total,
      percentile_cont(0.95) within group (order by total_duration_ms)         as p95_total
    from voice_interactions
    where created_at > '${OPTIMIZATION_CUTOFF_ISO}'::timestamptz;
  `);
  console.log(`\n--- Latency percentiles (ms), post-optimization only (created_at > ${OPTIMIZATION_CUTOFF_ISO}) ---`);
  console.log(postOptimization[0]);

  await prisma.$disconnect();
}
main();
