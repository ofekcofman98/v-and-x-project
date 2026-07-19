✓ Starting...
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
✓ Ready in 1821ms
 GET / 200 in 1038ms (compile: 582ms, render: 455ms)
 GET /dashboard 200 in 455ms (compile: 60ms, proxy.ts: 345ms, render: 51ms)
 GET /dashboard/base-lists 200 in 224ms (compile: 80ms, proxy.ts: 105ms, render: 40ms)
 GET /api/base-lists 200 in 1333ms (compile: 469ms, render: 865ms)
 GET /dashboard/base-lists/9a60183e-8159-467a-8a47-9b52be41fc75 200 in 844ms (compile: 689ms, proxy.ts: 111ms, render: 44ms)
 GET /api/base-lists/9a60183e-8159-467a-8a47-9b52be41fc75 200 in 1443ms (compile: 1198ms, render: 244ms)
 GET /api/base-lists/9a60183e-8159-467a-8a47-9b52be41fc75 200 in 257ms (compile: 23ms, render: 234ms)
 GET /dashboard/base-lists 200 in 429ms (compile: 8ms, proxy.ts: 380ms, render: 41ms)
 GET / 200 in 38ms (compile: 7ms, render: 31ms)
 GET /dashboard 200 in 156ms (compile: 8ms, proxy.ts: 119ms, render: 29ms)
 GET /dashboard/tables 200 in 262ms (compile: 73ms, proxy.ts: 156ms, render: 33ms)
 GET /api/tables 200 in 657ms (compile: 89ms, render: 568ms)
 GET /login 200 in 323ms (compile: 289ms, render: 34ms)
 GET /dashboard 200 in 234ms (compile: 8ms, proxy.ts: 199ms, render: 27ms)
 GET /dashboard 200 in 149ms (compile: 8ms, proxy.ts: 101ms, render: 40ms)
 GET /dashboard/tables 200 in 160ms (compile: 7ms, proxy.ts: 125ms, render: 28ms)
 GET /dashboard/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86 200 in 856ms (compile: 713ms, proxy.ts: 96ms, render: 46ms)
 GET /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86 200 in 2.2s (compile: 1181ms, render: 1007ms)
 GET /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86 200 in 392ms (compile: 21ms, render: 371ms)
 GET /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 1590ms (compile: 1202ms, render: 388ms)
 GET /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 400ms (compile: 28ms, render: 372ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '47520d46-0fde-48ea-8849-22f259673b00',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Transcription complete and cached: { transcript: 'Monica Geller, 24.', duration: 2467, promptUsed: true }
[VoiceEntryService] Quick extraction found pattern: { entity: 'Monica Geller', value: 24 }
[Matcher] 🎯 Level reached: exact with confidence 1
[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful
[EntityCache] SET: "Monica Geller, 24." → Monica Geller (exact)
[Performance] ✅ {
  transcript: 'Monica Geller, 24.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '2467ms',
  parsingDuration: '3ms',
  llmDuration: 'N/A',
  totalDuration: '2473ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: false,
  recommendation: ''
}
 POST /api/voice-entry 200 in 3.2s (compile: 676ms, render: 2.5s)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 707ms (compile: 24ms, render: 683ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '3c5d6776-ddc7-4abc-bf82-2dfa35bd90a0',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Transcription complete and cached: { transcript: 'Noa Cohen, 26.', duration: 1888, promptUsed: true }
[VoiceEntryService] Quick extraction found pattern: { entity: 'Noa Cohen', value: 26 }
[Matcher] 🎯 Level reached: exact with confidence 1
[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful
[EntityCache] SET: "Noa Cohen, 26." → Noa Cohen (exact)
[Performance] ✅ {
  transcript: 'Noa Cohen, 26.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1888ms',
  parsingDuration: '3ms',
  llmDuration: 'N/A',
  totalDuration: '1894ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: false,
  recommendation: ''
}
[EntityCache] Statistics: {
  hits: 0,
  misses: 2,
  hitRate: '0.0%',
  size: 2,
  estimatedTimeSaved: '0.0s'
}
 POST /api/voice-entry 200 in 1913ms (compile: 5ms, render: 1908ms)
 PATCH /api/tables/2b051809-1d69-43cf-8ddf-ce2d4a956d86/cells 200 in 381ms (compile: 22ms, render: 359ms)
[VoiceEntry] Parsed activeCell: {
  rowKey: '52f4017d-e19f-4cce-8f54-b994b0c73142',
  tableColumnId: 'ea8fc32d-f051-4d1a-90df-8ba35a81a2ae'
}
[VoiceEntryService] Transcription complete and cached: { transcript: 'John Snow, 10.', duration: 1349, promptUsed: true }
[VoiceEntryService] Quick extraction found pattern: { entity: 'John Snow', value: 10 }
[Matcher] 🎯 Level reached: exact with confidence 1
[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful
[EntityCache] SET: "John Snow, 10." → John Snow (exact)
[Performance] ✅ {
  transcript: 'John Snow, 10.',
  pathTaken: 'FAST_PATH',
  matchType: 'exact',
  cached: false,
  transcriptionDuration: '1349ms',
  parsingDuration: '2ms',
  llmDuration: 'N/A',
  totalDuration: '1354ms',
  budget: '3500ms',
  exceedsBudget: false,
  isOptimal: true,
  recommendation: '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.'
}