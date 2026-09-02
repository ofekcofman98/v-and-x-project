[VoiceEntryService] Audio received: { byteSize: 63461, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'Sarah Cohen, 27.',
  duration: 1015,
  audioByteSize: 63461,
  audioDurationSec: 3.9000000953674316,
  promptUsed: true,
  language: 'en'
}
[EntityCache] HIT: "Sarah Cohen, 27." → Sarah Cohen (saved ~5ms)
[VoiceEntryService] 🚀 ENTITY_CACHE_HIT: Saved ~1500ms LLM call
[Performance] ✅ {
  transcript: 'Sarah Cohen, 27.',
  pathTaken: 'ENTITY_CACHE_HIT',
  matchType: 'exact',
  cached: true,
  transcriptionDuration: '1015ms',
  parsingDuration: '2ms',
  llmDuration: 'N/A',
  totalDuration: '1022ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 1050ms (compile: 6ms, render: 1044ms)
 PATCH /api/tables/7dacb31f-f6ca-470a-97b6-fd72b073e2f8/cells 200 in 417ms (compile: 27ms, render: 390ms)
 POST /api/voice-telemetry 200 in 95ms (compile: 6ms, render: 89ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '40ccb6d2-3525-4fab-9dbf-c0aac9faaf29',
  tableColumnId: '66dc55aa-fcae-4b02-b397-809f732a9dfe'
}
[VoiceEntryService] Audio received: { byteSize: 42999, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 2220,
  audioByteSize: 42999,
  audioDurationSec: 2.640000104904175,
  promptUsed: true,
  language: 'en'
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: 
 POST /api/voice-entry 200 in 2.2s (compile: 4ms, render: 2.2s)
 POST /api/voice-telemetry 200 in 570ms (compile: 5ms, render: 565ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '40ccb6d2-3525-4fab-9dbf-c0aac9faaf29',
  tableColumnId: '66dc55aa-fcae-4b02-b397-809f732a9dfe'
}
[VoiceEntryService] Audio received: { byteSize: 53721, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'Rachel Green, 21.',
  duration: 1524,
  audioByteSize: 53721,
  audioDurationSec: 3.299999952316284,
  promptUsed: true,
  language: 'en'
}
[VoiceEntryService] Quick extraction found pattern: { entity: 'Rachel Green', value: 21 }
[Matcher] 🎯 Level reached: exact with confidence 1
[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful
[EntityCache] SET: "Rachel Green, 21." → Rachel Green (exact)
[Performance] ✅ {
  transcript: 'Rachel Green, 21.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1524ms',
  parsingDuration: '4ms',
  llmDuration: 'N/A',
  totalDuration: '1531ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 1551ms (compile: 5ms, render: 1546ms)
 PATCH /api/tables/7dacb31f-f6ca-470a-97b6-fd72b073e2f8/cells 200 in 394ms (compile: 24ms, render: 370ms)
 POST /api/voice-telemetry 200 in 92ms (compile: 5ms, render: 87ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: 'ad8775ce-eb7f-48e5-9aff-023ae59024e3',
  tableColumnId: '66dc55aa-fcae-4b02-b397-809f732a9dfe'
}
[VoiceEntryService] Audio received: { byteSize: 63461, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'David Miller, 27.',
  duration: 1429,
  audioByteSize: 63461,
  audioDurationSec: 3.9000000953674316,
  promptUsed: true,
  language: 'en'
}
[VoiceEntryService] Quick extraction found pattern: { entity: 'David Miller', value: 27 }
[Matcher] 🎯 Level reached: exact with confidence 1
[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful
[EntityCache] SET: "David Miller, 27." → David Miller (exact)
[Performance] ✅ {
  transcript: 'David Miller, 27.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1429ms',
  parsingDuration: '3ms',
  llmDuration: 'N/A',
  totalDuration: '1435ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 1452ms (compile: 4ms, render: 1448ms)
 PATCH /api/tables/7dacb31f-f6ca-470a-97b6-fd72b073e2f8/cells 200 in 690ms (compile: 22ms, render: 668ms)
 POST /api/voice-telemetry 200 in 100ms (compile: 5ms, render: 95ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: 'b5d5270c-b583-4757-912b-0452115500c7',
  tableColumnId: '66dc55aa-fcae-4b02-b397-809f732a9dfe'
}
[VoiceEntryService] Audio received: { byteSize: 42999, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '100.',
  duration: 697,
  audioByteSize: 42999,
  audioDurationSec: 2.640000104904175,
  promptUsed: true,
  language: 'en'
}
[VoiceEntryService] 🎯 FAST_PATH: Bare value for already-selected cell
[Performance] ✅ {
  transcript: '100.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '697ms',
  parsingDuration: '2ms',
  llmDuration: 'N/A',
  totalDuration: '701ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 718ms (compile: 4ms, render: 714ms)
 PATCH /api/tables/7dacb31f-f6ca-470a-97b6-fd72b073e2f8/cells 200 in 730ms (compile: 26ms, render: 703ms)
 POST /api/voice-telemetry 200 in 89ms (compile: 4ms, render: 84ms)