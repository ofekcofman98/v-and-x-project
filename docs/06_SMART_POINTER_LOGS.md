 POST /api/voice-entry 200 in 5.2s (compile: 4ms, render: 5.2s)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Audio received: { byteSize: 39103, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'Thank you.',
  duration: 1381,
  audioByteSize: 39103,
  audioDurationSec: 2.4000000953674316,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: Thank you.
 POST /api/voice-entry 200 in 1397ms (compile: 3ms, render: 1394ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Audio received: { byteSize: 45929, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'Thirty-eight.',
  duration: 1310,
  audioByteSize: 45929,
  audioDurationSec: 2.819999933242798,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Bare value for already-selected cell
[Performance] ✅ {
  transcript: 'Thirty-eight.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1310ms',
  parsingDuration: '1ms',
  llmDuration: 'N/A',
  totalDuration: '1313ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 1325ms (compile: 4ms, render: 1321ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 3.6s (compile: 2.6s, render: 1065ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: '73c27368-3d25-4b67-ae78-027e25b3cfa3'
}
[VoiceEntryService] Audio received: { byteSize: 46895, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '76',
  duration: 661,
  audioByteSize: 46895,
  audioDurationSec: 2.880000114440918,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)
[Performance] ✅ {
  transcript: '76',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '661ms',
  parsingDuration: '1ms',
  llmDuration: 'N/A',
  totalDuration: '664ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 678ms (compile: 5ms, render: 674ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 396ms (compile: 18ms, render: 378ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: '09e504f9-1c63-4563-96c2-28202d234025'
}
[VoiceEntryService] Audio received: { byteSize: 41051, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 2101,
  audioByteSize: 41051,
  audioDurationSec: 2.5199999809265137,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] ⚠️ Unusable transcript on first pass, retrying at temperature 0.2: 
[VoiceEntryService] Audio received: { byteSize: 41051, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 4331,
  audioByteSize: 41051,
  audioDurationSec: 2.5199999809265137,
  promptUsed: true,
  temperature: 0.2
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: 
 POST /api/voice-entry 200 in 4.3s (compile: 4ms, render: 4.3s)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: '09e504f9-1c63-4563-96c2-28202d234025'
}
[VoiceEntryService] Audio received: { byteSize: 45929, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '79',
  duration: 1253,
  audioByteSize: 45929,
  audioDurationSec: 2.819999933242798,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)
[Performance] ✅ {
  transcript: '79',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1253ms',
  parsingDuration: '1ms',
  llmDuration: 'N/A',
  totalDuration: '1257ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 1272ms (compile: 5ms, render: 1267ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 705ms (compile: 15ms, render: 690ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: 'ac69bb6c-812d-4a8a-bbc7-fce6f35fcc7d'
}
[VoiceEntryService] Audio received: { byteSize: 42999, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no',
  duration: 2677,
  audioByteSize: 42999,
  audioDurationSec: 2.640000104904175,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] ⚠️ Unusable transcript on first pass, retrying at temperature 0.2: no, no, no, no, no,, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no, no
[VoiceEntryService] Audio received: { byteSize: 42999, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 3156,
  audioByteSize: 42999,
  audioDurationSec: 2.640000104904175,
  promptUsed: true,
  temperature: 0.2
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: 
 POST /api/voice-entry 200 in 3.2s (compile: 4ms, render: 3.2s)
[VoiceEntry] Parsed activeCell: {
  rowKey: '2b0c80b0-deb3-4f36-8842-bdb3cc28a0d3',
  tableColumnId: 'ac69bb6c-812d-4a8a-bbc7-fce6f35fcc7d'
}
[VoiceEntryService] Audio received: { byteSize: 38137, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '‫כן.',
  duration: 3429,
  audioByteSize: 38137,
  audioDurationSec: 2.3399999141693115,
  promptUsed: true,
  temperature: 0
}
[Performance] ⚠️ BUDGET EXCEEDED: {
  transcript: '‫כן.',
  pathTaken: 'LLM_FALLBACK',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '3429ms',
  parsingDuration: '1ms',
  llmDuration: '1731ms',
  totalDuration: '5164ms',
  budget: '3500ms',
  exceedsBudget: true,
  isOptimal: false,
  recommendation: '⚠️ LLM fallback used. Consider improving fuzzy matching or caching this entity.'       
}
 POST /api/voice-entry 200 in 5.2s (compile: 5ms, render: 5.2s)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 1151ms (compile: 18ms, render: 1133ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Audio received: { byteSize: 39103, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'Ten.',
  duration: 766,
  audioByteSize: 39103,
  audioDurationSec: 2.4000000953674316,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Bare value for already-selected cell
[Performance] ✅ {
  transcript: 'Ten.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '766ms',
  parsingDuration: '0ms',
  llmDuration: 'N/A',
  totalDuration: '769ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 787ms (compile: 5ms, render: 782ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 712ms (compile: 17ms, render: 694ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: '73c27368-3d25-4b67-ae78-027e25b3cfa3'
}
[VoiceEntryService] Audio received: { byteSize: 41051, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '11',
  duration: 564,
  audioByteSize: 41051,
  audioDurationSec: 2.5199999809265137,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)
[Performance] ✅ {
  transcript: '11',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '564ms',
  parsingDuration: '1ms',
  llmDuration: 'N/A',
  totalDuration: '567ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 582ms (compile: 4ms, render: 577ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 390ms (compile: 16ms, render: 374ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: '09e504f9-1c63-4563-96c2-28202d234025'
}
[VoiceEntryService] Audio received: { byteSize: 37155, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '‫בואו.',
  duration: 895,
  audioByteSize: 37155,
  audioDurationSec: 2.2799999713897705,
  promptUsed: true,
  temperature: 0
}
[Performance] ✅ {
  transcript: '‫בואו.',
  pathTaken: 'LLM_FALLBACK',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '895ms',
  parsingDuration: '0ms',
  llmDuration: '1522ms',
  totalDuration: '2420ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: false,
  recommendation: '⚠️ LLM fallback used. Consider improving fuzzy matching or caching this entity.'       
}
 POST /api/voice-entry 200 in 2.4s (compile: 4ms, render: 2.4s)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 407ms (compile: 22ms, render: 385ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: 'ac69bb6c-812d-4a8a-bbc7-fce6f35fcc7d'
}
[VoiceEntryService] Audio received: { byteSize: 42033, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '12',
  duration: 634,
  audioByteSize: 42033,
  audioDurationSec: 2.5799999237060547,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)
[Performance] ✅ {
  transcript: '12',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '634ms',
  parsingDuration: '1ms',
  llmDuration: 'N/A',
  totalDuration: '639ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}
 POST /api/voice-entry 200 in 654ms (compile: 4ms, render: 650ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 399ms (compile: 18ms, render: 381ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: '09e504f9-1c63-4563-96c2-28202d234025'
}
[VoiceEntryService] Audio received: { byteSize: 41051, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 684,
  audioByteSize: 41051,
  audioDurationSec: 2.5199999809265137,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] ⚠️ Unusable transcript on first pass, retrying at temperature 0.2: 
[VoiceEntryService] Audio received: { byteSize: 41051, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 1857,
  audioByteSize: 41051,
  audioDurationSec: 2.5199999809265137,
  promptUsed: true,
  temperature: 0.2
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: 
 POST /api/voice-entry 200 in 1870ms (compile: 3ms, render: 1867ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: '09e504f9-1c63-4563-96c2-28202d234025'
}
[VoiceEntryService] Audio received: { byteSize: 42033, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: 'will, will, will, will, will, will, will, will, will, will, will, will, will, will, will, will,  will, will, will, will, will, will, will, will, will, will, will, will, will, will, will, will,',   
  duration: 1234,
  audioByteSize: 42033,
  audioDurationSec: 2.5799999237060547,
  promptUsed: true,
  temperature: 0
}
[VoiceEntryService] ⚠️ Unusable transcript on first pass, retrying at temperature 0.2: will, will, will, wwill, will, will, will, will, will, will, will, will, will, will, will, will,  will, will, will, will, will, will, will, will, will, will, will, will, will, will, will, will,
[VoiceEntryService] Audio received: { byteSize: 42033, mimeType: 'audio/webm' }
[VoiceEntryService] Transcription complete: {
  transcript: '',
  duration: 1738,
  audioByteSize: 42033,
  audioDurationSec: 2.5799999237060547,
  promptUsed: true,
  temperature: 0.2
}
[VoiceEntryService] Detected Whisper hallucination, skipping GPT call: 
 POST /api/voice-entry 200 in 1755ms (compile: 5ms, render: 1750ms)
