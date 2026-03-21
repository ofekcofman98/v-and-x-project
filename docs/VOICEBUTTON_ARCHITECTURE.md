# VoiceButton Refactoring - Architecture Diagram

## Before vs After

### BEFORE: God Object Anti-Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VoiceButton.tsx                              │
│                         (442 lines)                                 │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ UI Rendering & State                                       │   │
│  │ • Button appearance, animations, status text               │   │
│  │ • Recording state management                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Entity Matching Logic (performFuzzyMatch)                  │   │
│  │ • Fuse.js configuration                                    │   │
│  │ • Score calculation                                        │   │
│  │ • Alternatives generation                                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Result Handling (handleParsedResult)                       │   │
│  │ • Entity matching                                          │   │
│  │ • Confidence checking                                      │   │
│  │ • Cell updates                                             │   │
│  │ • Pointer advancement                                      │   │
│  │ • Continuous mode management                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Pointer Navigation (calculateNextCell)                     │   │
│  │ • Column-first logic                                       │   │
│  │ • Row-first logic                                          │   │
│  │ • End-of-table detection                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ API Communication                                          │   │
│  │ • FormData preparation                                     │   │
│  │ • Error handling                                           │   │
│  │ • Metrics tracking                                         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ Too many responsibilities (violation of Single Responsibility Principle)
❌ Hard to test (tightly coupled logic)
❌ Hard to maintain (changes affect many concerns)
❌ Hard to reuse (logic locked in component)
❌ Hard to extend (adding new matching strategies requires modifying component)
```

---

### AFTER: Separation of Concerns

```
┌──────────────────────────────────────────────────────────────────────┐
│                          VoiceButton.tsx                             │
│                           (~290 lines)                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ UI Layer (React Component)                                  │   │
│  │ • Button rendering & animations                             │   │
│  │ • Status text display                                       │   │
│  │ • User interaction handling                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                         │
│                            │ Uses                                    │
│                            ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Coordination Layer                                          │   │
│  │ • useVoiceActionHandler() ───────────────────────┐          │   │
│  │ • useContinuousVoice()                           │          │   │
│  │ • useVoiceEntry()                                │          │   │
│  └──────────────────────────────────────────────────┼──────────┘   │
│                                                      │              │
└──────────────────────────────────────────────────────┼──────────────┘
                                                       │
                                                       │
┌──────────────────────────────────────────────────────▼──────────────┐
│              lib/hooks/use-voice-action-handler.ts                  │
│                         (~190 lines)                                │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Business Logic Layer                                       │   │
│  │                                                            │   │
│  │  handleParsedResult(parsed: ParsedResult)                 │   │
│  │    │                                                       │   │
│  │    ├─► Step 1: Entity Matching                            │   │
│  │    │     │                                                 │   │
│  │    │     └─► match(entity, candidates)  ──────────┐       │   │
│  │    │          • Exact Match                       │       │   │
│  │    │          • Phonetic Match (Soundex)          │       │   │
│  │    │          • Fuzzy Match (Levenshtein)         │       │   │
│  │    │          • Returns: MatchResult              │       │   │
│  │    │                                              │       │   │
│  │    ├─► Step 2: Ambiguity Detection                │       │   │
│  │    │     │                                         │       │   │
│  │    │     └─► detectAmbiguity(matchResult) ────────┼───┐   │   │
│  │    │          • Analyzes confidence               │   │   │   │
│  │    │          • Checks for close alternatives     │   │   │   │
│  │    │          • Returns: AmbiguityResult          │   │   │   │
│  │    │                                              │   │   │   │
│  │    ├─► Step 3: Decision Making                    │   │   │   │
│  │    │     │                                         │   │   │   │
│  │    │     ├─ High Confidence (≥85%) ──────────────►│───┼───┼─► Auto-Confirm
│  │    │     │   • Update cell                        │   │   │   • Green flash
│  │    │     │   • Advance pointer                    │   │   │   • Next cell
│  │    │     │                                         │   │   │
│  │    │     ├─ Ambiguous (multiple close) ──────────►│───┼───┼─► Show Dialog
│  │    │     │   • Display alternatives               │   │   │   • User selects
│  │    │     │   • Wait for confirmation              │   │   │
│  │    │     │                                         │   │   │
│  │    │     └─ Low/No Confidence ────────────────────►│───┼───┼─► Show Dialog
│  │    │         • Display best guess                 │   │   │   • Allow edit
│  │    │         • User confirms/corrects             │   │   │
│  │    │                                              │   │   │
│  │    └─► Step 4: State Management                   │   │   │
│  │          • Update UIStore                          │   │   │
│  │          • Update TableDataStore                   │   │   │
│  │          • Trigger animations                      │   │   │
│  │                                                     │   │   │
│  └─────────────────────────────────────────────────────┼───┼───┘
│                                                        │   │
└────────────────────────────────────────────────────────┼───┼─────┐
                                                         │   │     │
                                                         │   │     │
┌────────────────────────────────────────────────────────▼───┼─────┤
│                   lib/matching/                            │     │
│                                                              │     │
│  ┌──────────────────────────────────────────────────────┐  │     │
│  │ matcher.ts - Cascading Matcher                       │  │     │
│  │                                                      │  │     │
│  │  match(input, entities, config)                     │  │     │
│  │    ├─► ExactMatcher                                 │  │     │
│  │    │    • normalize() → lowercase, trim             │  │     │
│  │    │    • compare strings                           │  │     │
│  │    │    • confidence: 1.0                           │  │     │
│  │    │    • matchType: 'exact'                        │  │     │
│  │    │                                                 │  │     │
│  │    ├─► PhoneticMatcher                              │  │     │
│  │    │    • soundex() → phonetic code                 │  │     │
│  │    │    • compare codes                             │  │     │
│  │    │    • confidence: 0.95                          │  │     │
│  │    │    • matchType: 'phonetic'                     │  │     │
│  │    │                                                 │  │     │
│  │    └─► FuzzyMatcher                                 │  │     │
│  │         • levenshteinDistance()                     │  │     │
│  │         • calculate similarity ratio               │  │     │
│  │         • confidence: variable (0.0-0.9)            │  │     │
│  │         • matchType: 'fuzzy'                        │  │     │
│  │                                                      │  │     │
│  │  Features:                                           │  │     │
│  │  • Caching (getCachedMatch/setCachedMatch)          │  │     │
│  │  • Early termination (stop at first confident match)│  │     │
│  │  • Configurable thresholds                          │  │     │
│  │                                                      │  │     │
│  └──────────────────────────────────────────────────────┘  │     │
└─────────────────────────────────────────────────────────────┘     │
                                                                    │
┌───────────────────────────────────────────────────────────────────▼┐
│                   lib/matching/ambiguity.ts                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ detectAmbiguity(matchResult, threshold = 0.85)             │   │
│  │                                                            │   │
│  │  Decision Tree:                                            │   │
│  │                                                            │   │
│  │  confidence ≥ 85% ──────────► 'auto_select'               │   │
│  │    isAmbiguous: false                                     │   │
│  │    recommendedAction: 'auto_select'                       │   │
│  │                                                            │   │
│  │  multiple close matches ────► 'ask_user'                  │   │
│  │    (score difference < 0.1)                               │   │
│  │    isAmbiguous: true                                      │   │
│  │    candidates: [top matches...]                           │   │
│  │                                                            │   │
│  │  confidence < 70% ──────────► 'create_new' or 'ask_user'  │   │
│  │    isAmbiguous: true                                      │   │
│  │    recommendedAction: depends on match quality            │   │
│  │                                                            │   │
│  │  no match ──────────────────► 'create_new'                │   │
│  │    isAmbiguous: false                                     │   │
│  │    candidates: []                                         │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                    lib/navigation/                                   │
│                                                                      │
│  column-first.ts              row-first.ts                          │
│  • getNextCellColumnFirst()   • getNextCellRowFirst()               │
│  • Down within column         • Right within row                    │
│  • Wrap to next column        • Wrap to next row                    │
│  • End-of-table detection     • End-of-table detection              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example

### High Confidence Match (Auto-Confirm):

```
User says: "Student A, 95"
    │
    ▼
1. VoiceButton receives audio
    │
    ▼
2. API returns ParsedResult:
   { entity: "Student A", value: 95 }
    │
    ▼
3. useVoiceActionHandler.handleParsedResult()
    │
    ├─► match("Student A", ["Alice Smith", "Bob Jones", ...])
    │     │
    │     └─► ExactMatcher.match()
    │           └─► "Student A" ≈ "Alice Smith" ? NO
    │     
    ├─► PhoneticMatcher.match()
    │     └─► soundex("Student A") = "S353"
    │          soundex("Alice Smith") = "A420"
    │          ❌ No match
    │     
    └─► FuzzyMatcher.match()
          └─► levenshtein("Student A", "Alice Smith")
               ✅ Match! confidence: 0.87
    │
    ▼
4. detectAmbiguity(matchResult)
   ├─ confidence: 0.87 ≥ 0.85 ✅
   └─► recommendedAction: 'auto_select'
    │
    ▼
5. Auto-Confirm Flow:
   ├─► setActiveCell(matched cell)
   ├─► updateCell(rowId, columnId, 95)
   ├─► setRecordingState('committing') ──► Green Flash ✨
   ├─► setTimeout(500ms)
   └─► setActiveCell(nextCell) ──────────► Blue Highlight Moves
    │
    ▼
6. Ready for next input! 🎤
```

### Ambiguous Match (Show Dialog):

```
User says: "John, 90"
    │
    ▼
1. API returns: { entity: "John", value: 90 }
    │
    ▼
2. match("John", ["John Smith", "John Doe", "Johnny Cash", ...])
    │
    └─► FuzzyMatcher returns:
         candidates: [
           { entity: "John Smith", score: 0.75 },
           { entity: "John Doe", score: 0.73 },
           { entity: "Johnny Cash", score: 0.71 }
         ]
    │
    ▼
3. detectAmbiguity(matchResult)
   ├─ Multiple close matches detected!
   ├─ score difference: 0.75 - 0.73 = 0.02 < 0.1
   └─► isAmbiguous: true
       recommendedAction: 'ask_user'
    │
    ▼
4. Show Confirmation Dialog:
   ┌─────────────────────────────────────┐
   │ Which did you mean?                 │
   │                                     │
   │ ○ John Smith     (75% confidence)   │
   │ ○ John Doe       (73% confidence)   │
   │ ○ Johnny Cash    (71% confidence)   │
   │                                     │
   │ [ Confirm ]  [ Cancel ]             │
   └─────────────────────────────────────┘
    │
    ▼
5. User selects → Continue to update & advance
```

---

## Benefits Summary

### ✅ Separation of Concerns
- **VoiceButton**: UI only
- **useVoiceActionHandler**: Business logic
- **Matching System**: Reusable algorithms

### ✅ Testability
- Each layer can be tested independently
- Mock hooks easily
- Test matching strategies in isolation

### ✅ Maintainability
- Clear boundaries between concerns
- Easy to find and fix bugs
- Self-documenting architecture

### ✅ Extensibility
- Add new matchers to chain without touching UI
- Improve ambiguity detection independently
- Enhance pointer navigation logic separately

### ✅ Reusability
- Matching system can be used elsewhere
- Hooks can be shared across components
- Navigation logic is centralized

### ✅ Performance
- Cascading matcher with early termination
- Built-in caching
- Optimized for common cases
