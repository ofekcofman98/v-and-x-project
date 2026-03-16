# Smart Pointer Desync Fix - Testing Checklist

**Date**: March 16, 2026  
**Issue Fixed**: State desync between voice entity resolution and Smart Pointer auto-advance  
**PR/Commit**: Ready for Testing

---

## Pre-Test Setup

- [ ] Development server is running (`npm run dev`)
- [ ] Navigate to the demo table page (e.g., `http://localhost:3001/demo/table`)
- [ ] Open browser DevTools Console to monitor debug logs
- [ ] Microphone permissions are granted
- [ ] Audio input device is working

---

## Test Suite 1: Basic Sequential Entry (Column-First Mode)

**Goal**: Verify pointer advances smoothly from 1st → 2nd → 3rd student without getting stuck

### Test 1.1: Three Sequential Entries
- [ ] Start continuous mode (click infinity button)
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student A, 95"
- [ ] **Verify**: Cell updates to 95, green flash, pointer advances to (Student B, Value)
- [ ] Say: "Student B, 88"
- [ ] **Verify**: Cell updates to 88, green flash, pointer advances to (Student C, Value)
- [ ] Say: "Student C, 92"
- [ ] **Verify**: Cell updates to 92, green flash, pointer advances to (Student D, Value)

**Expected Console Logs**:
```
[VoiceButton] Synced pointer to matched entity: { rowId: "student-a", columnId: "value" }
[VoiceButton] Advanced pointer to: { rowId: "student-b", columnId: "value" }
[VoiceButton] Auto-restarting listening after pointer advance
[VoiceButton] Synced pointer to matched entity: { rowId: "student-b", columnId: "value" }
[VoiceButton] Advanced pointer to: { rowId: "student-c", columnId: "value" }
[VoiceButton] Auto-restarting listening after pointer advance
...
```

**Pass Criteria**:
- ✅ Pointer advances correctly A → B → C → D
- ✅ No stuck pointer on Student B or C
- ✅ Continuous mode stays active and listening between entries
- ✅ Green flash animation visible before each advance

---

### Test 1.2: Five Sequential Entries (Full Column)
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student A, 95"
- [ ] Say: "Student B, 88"
- [ ] Say: "Student C, 92"
- [ ] Say: "Student D, 85"
- [ ] Say: "Student E, 90"

**Expected**:
- [ ] Pointer advances through all 5 students smoothly
- [ ] After Student E entry, pointer stops (end of column)
- [ ] Continuous mode automatically stops
- [ ] Console logs: `[VoiceButton] End of table reached`

**Pass Criteria**:
- ✅ All 5 entries processed correctly
- ✅ Pointer reaches end of table
- ✅ Continuous mode stops automatically

---

## Test Suite 2: Out-of-Order Entry

**Goal**: Verify pointer jumps to matched entity even when user says a different student

### Test 2.1: Jump to Last Student
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student E, 90"

**Expected**:
- [ ] Pointer immediately JUMPS from Student A to Student E
- [ ] Cell (Student E, Value) updates to 90
- [ ] Green flash on Student E cell
- [ ] Pointer stays on Student E (end of column)
- [ ] Continuous mode stops

**Console Logs**:
```
[VoiceButton] Synced pointer to matched entity: { rowId: "student-e", columnId: "value" }
[VoiceButton] End of table reached
```

**Pass Criteria**:
- ✅ Pointer jumps from A to E (not to B)
- ✅ Data written to Student E (not Student B)
- ✅ UI and data are synchronized

---

### Test 2.2: Jump to Middle Student
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student C, 92"

**Expected**:
- [ ] Pointer jumps from Student A to Student C
- [ ] Cell (Student C, Value) updates to 92
- [ ] Pointer advances to Student D (next after C)
- [ ] Continuous mode stays active

**Console Logs**:
```
[VoiceButton] Synced pointer to matched entity: { rowId: "student-c", columnId: "value" }
[VoiceButton] Advanced pointer to: { rowId: "student-d", columnId: "value" }
```

**Pass Criteria**:
- ✅ Pointer jumps from A to C
- ✅ Next advance is from C to D (not from A to B)

---

### Test 2.3: Mixed Order Entries
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student A, 95" → Advances to B
- [ ] Say: "Student D, 88" → Jumps to D, advances to E
- [ ] Say: "Student E, 92" → Stays on E (end of table)

**Pass Criteria**:
- ✅ Sequence flows: A → B → D → E
- ✅ No desync between pointer and data
- ✅ Continuous mode stops at end

---

## Test Suite 3: Row-First Mode

**Goal**: Verify fixes work in row-first navigation mode

### Test 3.1: Sequential Entries in Row-First Mode
- [ ] Toggle to Row-First mode (Ctrl/⌘+M or mode toggle button)
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student A, 95" → Advances to (Student A, Status)
- [ ] Say: "Student A, Complete" → Advances to (Student B, Entity)
- [ ] Say: "Student B, 88" → Advances to (Student B, Status)

**Expected**:
- [ ] Pointer advances RIGHT across columns (not down)
- [ ] After last column, wraps to first column of next row
- [ ] No stuck pointer

**Pass Criteria**:
- ✅ Row-first navigation works correctly
- ✅ Pointer advances through columns then wraps to next row

---

## Test Suite 4: Edge Cases

### Test 4.1: Low Confidence Match
- [ ] Start continuous mode
- [ ] Say a student name with poor pronunciation
- [ ] **Verify**: Confirmation dialog appears (should NOT auto-advance)
- [ ] Cancel the dialog
- [ ] **Verify**: Pointer stays on current cell

**Pass Criteria**:
- ✅ Low confidence (<0.8) does NOT trigger auto-advance
- ✅ Manual confirmation required

---

### Test 4.2: Stopping Continuous Mode Mid-Entry
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Say: "Student A, 95" → Wait for advance to B
- [ ] Press Escape key (or click infinity button to stop)
- [ ] **Verify**: Continuous mode stops
- [ ] **Verify**: Pointer stays on current position
- [ ] **Verify**: No auto-restart happens

**Pass Criteria**:
- ✅ Continuous mode can be stopped mid-flow
- ✅ No lingering timers cause issues

---

### Test 4.3: Start Continuous Mode at End of Table
- [ ] Click on cell (Student E, Status) - the last cell
- [ ] Start continuous mode
- [ ] Say: "Student E, Complete"
- [ ] **Verify**: Cell updates
- [ ] **Verify**: Continuous mode automatically stops (end of table)

**Pass Criteria**:
- ✅ End-of-table detection works
- ✅ Continuous mode stops gracefully

---

## Test Suite 5: Stress Testing

### Test 5.1: Rapid Sequential Entries
- [ ] Start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Speak quickly: "Student A, 95" (pause 1s) "Student B, 88" (pause 1s) "Student C, 92"
- [ ] **Verify**: All entries are captured correctly
- [ ] **Verify**: Pointer advances smoothly
- [ ] **Verify**: No entries are dropped

**Pass Criteria**:
- ✅ Rapid entries are handled correctly
- ✅ No race conditions cause dropped entries

---

### Test 5.2: Start/Stop Multiple Times
- [ ] Start continuous mode
- [ ] Say: "Student A, 95"
- [ ] Stop continuous mode (press Esc)
- [ ] Start continuous mode again
- [ ] Say: "Student B, 88"
- [ ] Stop continuous mode
- [ ] Start continuous mode again
- [ ] Say: "Student C, 92"

**Pass Criteria**:
- ✅ Mode can be toggled on/off multiple times
- ✅ State remains consistent across toggles

---

## Test Suite 6: Console Log Verification

**Goal**: Verify debug logs are helpful and accurate

### Test 6.1: Check Console Logs
Run Test 1.1 (Three Sequential Entries) and verify console logs contain:

- [ ] `[VoiceButton] Synced pointer to matched entity:` (before each update)
- [ ] `[VoiceButton] Advanced pointer to:` (after each advance)
- [ ] `[VoiceButton] Auto-restarting listening after pointer advance` (between entries)
- [ ] No error messages
- [ ] No infinite loop warnings

**Pass Criteria**:
- ✅ Logs are clear and informative
- ✅ Logs accurately reflect pointer movements

---

## Regression Tests

### Regression 1: Manual Mode Still Works
- [ ] **Do NOT** start continuous mode
- [ ] Click on cell (Student A, Value)
- [ ] Press and hold the mic button
- [ ] Say: "Student A, 95"
- [ ] Release the mic button
- [ ] **Verify**: Cell updates correctly
- [ ] **Verify**: Pointer does NOT auto-advance (manual mode behavior)

**Pass Criteria**:
- ✅ Manual mode (press-and-hold) unaffected by continuous mode fixes

---

### Regression 2: Confirmation Dialog Still Works
- [ ] Click on cell (Student A, Value)
- [ ] Say a name that doesn't match well (e.g., "Student X")
- [ ] **Verify**: Confirmation dialog appears with alternatives
- [ ] Select an alternative and confirm
- [ ] **Verify**: Cell updates with selected value

**Pass Criteria**:
- ✅ Low-confidence confirmation flow still works

---

## Performance Checks

- [ ] No noticeable lag when advancing pointer
- [ ] Green flash animation is smooth
- [ ] State transitions happen within expected time windows:
  - Commit animation: 500ms
  - Advance transition: 500ms
  - Auto-restart: 400ms after advancing state

**Pass Criteria**:
- ✅ No performance degradation
- ✅ Smooth UX

---

## Sign-Off

### Bug 1: Out-of-Order Updates Desync
- [ ] **FIXED**: Pointer jumps to matched entity before updating cell
- [ ] **VERIFIED**: Data and pointer are synchronized

### Bug 2: Pointer Gets Stuck After 2nd Student
- [ ] **FIXED**: Pointer advances smoothly through all students
- [ ] **VERIFIED**: No stuck pointer after 2nd entry

### Overall
- [ ] All test suites passed
- [ ] No regressions introduced
- [ ] Console logs are helpful and accurate
- [ ] Performance is acceptable
- [ ] Ready for production deployment

---

**Tester Name**: ______________________________  
**Date**: ______________________________  
**Signature**: ______________________________

---

## Notes / Issues Found

(Use this space to note any issues encountered during testing)

```
Issue 1:
Description: 
Steps to Reproduce:
Severity: (Critical / High / Medium / Low)

Issue 2:
Description:
Steps to Reproduce:
Severity:
```
