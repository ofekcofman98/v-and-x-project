/**
 * Table API Test Script
 * 
 * This script tests the Table API endpoints.
 * Run with: node --loader ts-node/esm test-table-api.mjs
 * 
 * Prerequisites:
 * 1. Dev server running: npm run dev
 * 2. Database migrated: npx prisma migrate dev
 * 3. At least one BaseList exists in the database
 */

const BASE_URL = "http://localhost:3000";

// ANSI color codes for pretty output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ─────────────────────────────────────────────────────────
// Test: Create a Table
// ─────────────────────────────────────────────────────────

async function testCreateTable(baseListId) {
  log("\n📝 TEST 1: POST /api/tables (Create Table)", "blue");

  const payload = {
    name: "Math Quiz - April 2026",
    description: "Monthly math assessment",
    baseListId: baseListId,
    representativeColumnKey: "first_name",
    columns: [
      {
        label: "Score",
        type: "NUMBER",
        validation: { min: 0, max: 100 },
      },
      {
        label: "Notes",
        type: "TEXT",
      },
      {
        label: "Completed",
        type: "BOOLEAN",
      },
    ],
  };

  try {
    const response = await fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      log("✅ Table created successfully!", "green");
      console.log("Created Table:", JSON.stringify(data.data, null, 2));
      return data.data.id;
    } else {
      log(`❌ Failed: ${data.error}`, "red");
      return null;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Test: Get All Tables
// ─────────────────────────────────────────────────────────

async function testGetAllTables() {
  log("\n📋 TEST 2: GET /api/tables (Get All Tables)", "blue");

  try {
    const response = await fetch(`${BASE_URL}/api/tables`);
    const data = await response.json();

    if (response.ok && data.success) {
      log(`✅ Found ${data.data.length} table(s)`, "green");
      data.data.forEach((table) => {
        console.log(`  - ${table.name} (${table._count.columns} columns)`);
        if (table.baseList) {
          console.log(`    BaseList: ${table.baseList.name}`);
        }
      });
      return true;
    } else {
      log(`❌ Failed: ${data.error}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Test: Get Single Table
// ─────────────────────────────────────────────────────────

async function testGetSingleTable(tableId) {
  log(`\n🔍 TEST 3: GET /api/tables/${tableId} (Get Single Table)`, "blue");

  try {
    const response = await fetch(`${BASE_URL}/api/tables/${tableId}`);
    const data = await response.json();

    if (response.ok && data.success) {
      log("✅ Table fetched successfully!", "green");
      console.log("Table Details:");
      console.log(`  Name: ${data.data.name}`);
      console.log(`  Columns: ${data.data.columns.length}`);
      data.data.columns.forEach((col) => {
        console.log(`    - ${col.label} (${col.type})`);
      });

      if (data.data.baseList) {
        console.log(`  BaseList: ${data.data.baseList.name}`);
        console.log(`  Entities: ${data.data.baseList.entities.length}`);
        data.data.baseList.entities.slice(0, 3).forEach((entity) => {
          const repValue = entity.values[data.data.representativeColumnKey];
          console.log(`    - ${repValue}`);
        });
        if (data.data.baseList.entities.length > 3) {
          console.log(`    ... and ${data.data.baseList.entities.length - 3} more`);
        }
      }
      return true;
    } else {
      log(`❌ Failed: ${data.error}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Test: Delete Table
// ─────────────────────────────────────────────────────────

async function testDeleteTable(tableId) {
  log(`\n🗑️  TEST 4: DELETE /api/tables/${tableId} (Delete Table)`, "blue");

  try {
    const response = await fetch(`${BASE_URL}/api/tables/${tableId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (response.ok && data.success) {
      log("✅ Table deleted successfully!", "green");
      console.log(`  Message: ${data.message}`);
      return true;
    } else {
      log(`❌ Failed: ${data.error}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Test: Error Handling (Invalid BaseList ID)
// ─────────────────────────────────────────────────────────

async function testInvalidBaseListId() {
  log("\n⚠️  TEST 5: POST /api/tables (Invalid BaseList ID)", "blue");

  const payload = {
    name: "Test Table",
    representativeColumnKey: "name",
    baseListId: "00000000-0000-0000-0000-000000000000",
    columns: [{ label: "Score", type: "NUMBER" }],
  };

  try {
    const response = await fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 404 && !data.success) {
      log("✅ Correctly returned 404 for non-existent BaseList", "green");
      return true;
    } else {
      log("❌ Should have returned 404 error", "red");
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Main Test Runner
// ─────────────────────────────────────────────────────────

async function runTests() {
  log("════════════════════════════════════════════════", "yellow");
  log("       TABLE API TEST SUITE", "yellow");
  log("════════════════════════════════════════════════", "yellow");

  // First, fetch existing BaseLists to get a valid ID
  log("\n🔧 Setup: Fetching existing BaseLists...", "blue");
  try {
    const response = await fetch(`${BASE_URL}/api/base-lists`);
    const data = await response.json();

    if (!data.success || data.data.length === 0) {
      log("\n❌ No BaseLists found. Please create at least one BaseList first.", "red");
      log("   You can use: POST /api/base-lists", "yellow");
      return;
    }

    // Find a BaseList that has a "first_name" column
    const suitableBaseList = data.data.find((baseList) => {
      const schema = baseList.schema;
      return schema.columns.some((col) => col.id === "first_name");
    });

    if (!suitableBaseList) {
      log("\n❌ No BaseList found with a 'first_name' column.", "red");
      log("   Available BaseLists:", "yellow");
      data.data.forEach((bl) => {
        const columnIds = bl.schema.columns.map((c) => c.id).join(", ");
        log(`   - ${bl.name}: columns [${columnIds}]`, "yellow");
      });
      log("\n   Please create a BaseList with a 'first_name' column.", "yellow");
      return;
    }

    const baseListId = suitableBaseList.id;
    log(`✅ Using BaseList: ${suitableBaseList.name} (${baseListId})`, "green");
    
    const columnIds = suitableBaseList.schema.columns.map((c) => c.id).join(", ");
    log(`   Columns: ${columnIds}`, "green");

    // Run the test suite
    const tableId = await testCreateTable(baseListId);
    if (!tableId) return;

    await testGetAllTables();
    await testGetSingleTable(tableId);
    await testInvalidBaseListId();
    await testDeleteTable(tableId);

    log("\n════════════════════════════════════════════════", "yellow");
    log("       ✅ TEST SUITE COMPLETED", "green");
    log("════════════════════════════════════════════════", "yellow");
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, "red");
    log("Make sure the dev server is running: npm run dev", "yellow");
  }
}

// Run tests
runTests();
