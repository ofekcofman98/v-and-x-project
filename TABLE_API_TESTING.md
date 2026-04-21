# Table API Testing Guide

This guide helps you test the Table API endpoints manually or with the automated test script.

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Ensure database is migrated:**
   ```bash
   npx prisma migrate dev
   ```

3. **Create a BaseList first** (Tables need a BaseList to reference):
   ```bash
   curl -X POST http://localhost:3000/api/base-lists \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Class 10A",
       "description": "Math class students",
       "schema": {
         "columns": [
           {
             "id": "first_name",
             "label": "First Name",
             "type": "text"
           },
           {
             "id": "student_id",
             "label": "Student ID",
             "type": "text"
           }
         ]
       },
       "entities": [
         {
           "values": {
             "first_name": "Alice Johnson",
             "student_id": "001"
           }
         },
         {
           "values": {
             "first_name": "Bob Smith",
             "student_id": "002"
           }
         }
       ]
     }'
   ```

   **Save the returned `id` from the response!**

---

## Automated Testing

Run the automated test script:

```bash
node test-table-api.mjs
```

This will test all endpoints automatically and show colored output.

---

## Manual Testing with cURL

### 1. Create a Table

Replace `<BASE_LIST_ID>` with your actual BaseList ID:

```bash
curl -X POST http://localhost:3000/api/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Math Quiz - April 2026",
    "description": "Monthly math assessment",
    "baseListId": "<BASE_LIST_ID>",
    "representativeColumnKey": "first_name",
    "columns": [
      {
        "label": "Score",
        "type": "NUMBER",
        "validation": {
          "min": 0,
          "max": 100
        }
      },
      {
        "label": "Notes",
        "type": "TEXT"
      },
      {
        "label": "Completed",
        "type": "BOOLEAN"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Math Quiz - April 2026",
    "columns": [
      {
        "id": "...",
        "key": "score",
        "label": "Score",
        "type": "NUMBER",
        ...
      }
    ]
  }
}
```

**Save the table `id` from the response!**

---

### 2. Get All Tables

```bash
curl http://localhost:3000/api/tables
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Math Quiz - April 2026",
      "baseList": {
        "id": "...",
        "name": "Class 10A"
      },
      "_count": {
        "columns": 3
      }
    }
  ]
}
```

---

### 3. Get a Single Table

Replace `<TABLE_ID>` with your table ID:

```bash
curl http://localhost:3000/api/tables/<TABLE_ID>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Math Quiz - April 2026",
    "representativeColumnKey": "first_name",
    "columns": [
      {
        "key": "score",
        "label": "Score",
        "type": "NUMBER",
        ...
      }
    ],
    "baseList": {
      "name": "Class 10A",
      "entities": [
        {
          "id": "...",
          "values": {
            "first_name": "Alice Johnson",
            "student_id": "001"
          }
        },
        {
          "id": "...",
          "values": {
            "first_name": "Bob Smith",
            "student_id": "002"
          }
        }
      ]
    }
  }
}
```

**This is the critical endpoint for the Grid UI!** It returns:
- Table columns (for the data entry fields)
- BaseList entities (for the rows/student names)

---

### 4. Delete a Table

Replace `<TABLE_ID>` with your table ID:

```bash
curl -X DELETE http://localhost:3000/api/tables/<TABLE_ID>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Table 'Math Quiz - April 2026' deleted successfully"
}
```

---

## Testing Error Handling

### Invalid BaseList ID

```bash
curl -X POST http://localhost:3000/api/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Table",
    "baseListId": "00000000-0000-0000-0000-000000000000",
    "representativeColumnKey": "name",
    "columns": [
      {
        "label": "Score",
        "type": "NUMBER"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "BaseList with id '00000000-0000-0000-0000-000000000000' not found"
}
```
**Status Code:** 404

---

### Invalid Representative Column

```bash
curl -X POST http://localhost:3000/api/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Table",
    "baseListId": "<VALID_BASE_LIST_ID>",
    "representativeColumnKey": "nonexistent_column",
    "columns": [
      {
        "label": "Score",
        "type": "NUMBER"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Representative column 'nonexistent_column' not found in BaseList schema"
}
```
**Status Code:** 400

---

### Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Table"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Representative column key is required, At least one data column is required"
}
```
**Status Code:** 400

---

## Using PowerShell (Windows)

If you're on Windows and prefer PowerShell:

```powershell
# Create Table
$body = @{
    name = "Math Quiz - April 2026"
    baseListId = "<BASE_LIST_ID>"
    representativeColumnKey = "first_name"
    columns = @(
        @{
            label = "Score"
            type = "NUMBER"
        }
    )
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/tables" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# Get All Tables
Invoke-RestMethod -Uri "http://localhost:3000/api/tables"

# Get Single Table
Invoke-RestMethod -Uri "http://localhost:3000/api/tables/<TABLE_ID>"

# Delete Table
Invoke-RestMethod -Uri "http://localhost:3000/api/tables/<TABLE_ID>" `
  -Method DELETE
```

---

## Next Steps

After testing these endpoints, you can:

1. **Build the Grid UI** using the `GET /api/tables/[id]` endpoint
2. **Integrate with Voice Entry** using the table schema
3. **Add TableCell endpoints** for data entry (coming next)

## Troubleshooting

- **404 Error on BaseList:** Make sure you created a BaseList first
- **Port 3000 already in use:** Change the port in `test-table-api.mjs`
- **Database errors:** Run `npx prisma migrate dev` and `npx prisma generate`
