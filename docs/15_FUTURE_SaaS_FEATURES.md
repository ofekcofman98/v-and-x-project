# VocalGrid - Future SaaS Features Roadmap

**Version:** 1.0  
**Last Updated:** 2025-05-26  
**Status:** Planning Phase

---

## Features Overview

### High Priority

- [ ] **Representative Column Selection & Cache Warming**  
  Explicit representative column selection with intelligent cache pre-warming for frequently used entities. Reduces P95 latency from 3900ms to 1305ms (53% improvement).  
  → [Full Specification](./features/01_cache_warming.md)

- [ ] **Multi-Tenant User Management**  
  Organization-level user management with RBAC, table sharing, and team collaboration. Unlocks enterprise pricing tier.  
  → [Full Specification](./features/05_multi_tenant_auth.md)

- [ ] **CSV/Excel Import & Export**  
  Import tables from CSV/Excel files and export to standard formats using xlsx library. Enables legacy data migration.  
  → [Full Specification](./features/08_csv_import_export.md)

### Medium Priority

- [ ] **Column-Template Lists**  
  Reusable column schema templates that can be injected into multiple BaseLists. Reduces setup time by 80%.  
  → [Full Specification](./features/02_column_templates.md)

- [ ] **AI Table Creator Agent**  
  Natural language prompt-to-table creation using GPT-4 for schema inference. Reduces creation time from 5 minutes to 30 seconds.  
  → [Full Specification](./features/03_ai_table_agent.md)

- [ ] **Computed/Formula Columns**  
  Client-side reactive columns with formulas (SUM, AVERAGE, COUNT) without backend recalculation.  
  → [Full Specification](./features/04_computed_columns.md)

- [ ] **Private Columns**  
  Column-level access control where certain columns are visible only to users with specific roles.  
  → [Full Specification](./features/07_private_columns.md)

### Low Priority

- [ ] **Column Visibility/Hiding**  
  Notion-style column hiding to reduce visual clutter without deleting data.  
  → [Full Specification](./features/06_column_visibility.md)

- [ ] **Vision-to-Table**  
  GPT-4 Vision extraction of table data from images of paper sheets or handwritten notes.  
  → [Full Specification](./features/09_vision_to_table.md)

---

## Implementation Status

| Feature | Priority | Status | Est. Time |
|---------|----------|--------|-----------|
| Cache Warming | High | Done | 2 weeks |
| Multi-Tenant | High | Not Started | 4 weeks |
| CSV Import/Export | High | Not Started | 3 weeks |
| Column Templates | Medium | Done | 2 weeks |
| AI Table Agent | Medium | Not Started | 3 weeks |
| Computed Columns | Medium | Not Started | 2 weeks |
| Private Columns | Medium | Not Started | 3 weeks |
| Column Visibility | Low | Not Started | 1 week |
| Vision-to-Table | Low | Not Started | 4 weeks |
| Voice-pipeline-hardening | High | Done | 4 weeks |
| DB loading optimization | High | Not started | ? | 

---

**Total Estimated Development Time:** 24 weeks (6 months)