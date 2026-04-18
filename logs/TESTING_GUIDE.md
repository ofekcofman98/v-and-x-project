# Voice Pipeline Testing Guide

## Prerequisites
✅ OpenAI API key configured in `.env.local`
✅ Dependencies installed (`chrono-node`, `openai`, `zod`)
✅ Error handling + monitoring implemented

---

## Step 1: Start the Dev Server

```bash
npm run dev
```

Wait for:
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

---

## Step 2: Open the Demo Page

Navigate to: **http://localhost:3000/demo/table**

You should see:
- A data table with student names and grades
- Smart Pointer controls (navigation mode, active cell info)
- A blue microphone button at the bottom
- Demo state controls

---

## Step 3: Select a Cell

**Important:** You must select a cell before recording!

Click any cell in the table, or use the "Quick Select Cell" buttons:
- "A - Entity" → selects row1, entity column
- "B - Value" → selects row2, value column  
- "C - Status" → selects row3, status column

You should see:
- Blue border around the selected cell
- "Active Cell" panel shows the row/column IDs
- Blue corner indicator on the cell

---

## Step 4: Test Voice Recording

### Test 1: Basic Number Entry
1. **Select** the "Value" column for "Student A"
2. **Click** the microphone button (it turns red and pulses)
3. **Say clearly:** "Student A, ninety five"
4. **Click** again to stop recording
5. **Wait** for processing (button shows "Processing...")

**Expected Result:**
- Console logs show transcription and parse phases
- Performance metrics appear in console
- "Parsed Result" card shows:
  - Entity: "Alice Smith" (matched from "Student A")
  - Value: 95 (parsed from "ninety five")
  - Confidence: ~0.9-1.0

### Test 2: Boolean Entry
1. **Select** a cell in the "Status" column
2. **Record** and say: "Student B, complete"
3. **Stop** recording

**Expected Result:**
- Entity: "Bob Johnson"
- Value: true (if column is boolean) or "complete" (if text)
- Confidence: high

### Test 3: Error Handling - No Cell Selected
1. **Click** "Clear" to deselect the active cell
2. **Try** to record

**Expected Result:**
- Console error: `NO_CELL_SELECTED`
- Recording state returns to idle
- Red flash on button

### Test 4: Error Handling - Ambiguous Match
1. **Select** any cell
2. **Record** and say: "Student X, 100" (non-existent student)

**Expected Result:**
- Console error: `PARSE_NO_MATCH` or `PARSE_AMBIGUOUS`
- No confirmation card appears
- Recording state returns to error

---

## Step 5: Check Console Logs

Open DevTools (F12) → Console tab. You should see:

### Successful Flow:
```
Transcription result: "Student A, ninety five"
[Performance] transcribe: { phase: 'transcribe', duration: 1523, success: true, exceeded: false }
[Performance] parse: { phase: 'parse', duration: 847, success: true, exceeded: false }
[Performance] total: { phase: 'total', duration: 2370, success: true, exceeded: false }
```

### Failed Flow (no match):
```
[Voice] PARSE_NO_MATCH: Could not identify the entity. Please try again.
[Performance] parse: { phase: 'parse', duration: 892, success: false, error: 'No match found' }
[Performance] total: { phase: 'total', duration: 2811, success: false, error: 'PARSE_NO_MATCH' }
```

---

## Step 6: Verify Latency Budget

Check that performance metrics stay within budget:
- **Transcribe:** < 2000ms (2 seconds)
- **Parse:** < 1000ms (1 second)
- **Total:** < 3500ms (3.5 seconds)

If any phase exceeds the budget, console will show:
```
⚠️ [Performance] parse exceeded budget: { actual: 1234, budget: 1000 }
```

---

## Common Issues & Fixes

### Issue: "Microphone access denied"
**Fix:** Click the browser permission prompt and allow microphone access.

### Issue: "No speech detected"
**Fix:** 
- Speak louder or closer to the mic
- Check your system mic settings
- Try a different browser (Chrome/Edge recommended)

### Issue: "Transcription failed"
**Fix:** 
- Check `.env.local` has valid `OPENAI_API_KEY`
- Restart the dev server (`Ctrl+C` then `npm run dev`)
- Check OpenAI API status

### Issue: Parsing returns wrong entity
**Fix:**
- Speak more clearly
- Use full names instead of abbreviations
- Check the table schema has correct row labels

### Issue: TypeScript errors on build
**Fix:**
```bash
npm run build
```
If errors appear, share them and I'll help fix.

---

## Next Steps After Testing

Once basic flow works:
1. **Cell Update Mutation** – Wire the "confirm" button to actually save data
2. **Smart Pointer Advancement** – Auto-move to next cell after commit
3. **Ambiguity Dialog** – Show alternatives when confidence is low
4. **Real Database** – Connect to Supabase instead of mock data

---

## Debug Commands

```bash
# Check if server is running
curl http://localhost:3000/api/transcribe

# Test parse endpoint directly
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Student A, 95",
    "tableSchema": { "columns": [...], "rows": [...] },
    "activeCell": { "rowId": "row1", "columnId": "value" },
    "navigationMode": "column-first"
  }'
```

---

**Ready to test!** Follow steps 1-6 above and let me know what happens. 🎤
