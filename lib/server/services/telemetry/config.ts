// docs/features/19_voice_telemetry.md §3 Constraint 7 — this flag inverts the
// repo's usual ENABLE_X idiom (transcription.ts defaults ON) and defaults OFF,
// since the gated columns carry raw transcript content and should be opt-in.
export const VOICE_ACCURACY_TELEMETRY_ENABLED = process.env.ENABLE_VOICE_ACCURACY_TELEMETRY === 'true';
